import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { ContentCabinetDoc } from "./contentcabinet";
import { NotAllowedError, NotFoundError } from "./errors";
import { PostDoc } from "./post";

export interface DiscoveryDoc extends BaseDoc {
  user: ObjectId; // the user who receives the discovery
  discoverred: ObjectId[]; // set of posts that the referee has not seen
}

export interface SeenPostDoc extends BaseDoc {
  user: ObjectId;
  preference: ObjectId[]; // set of tags that the referee likes
  seen: ObjectId[]; // set of posts that the referee has seen
}

export default class DiscoveryConcept {
  public readonly discoveries = new DocCollection<DiscoveryDoc>("discoveries");
  public readonly seenPosts = new DocCollection<SeenPostDoc>("seenPosts");
  private readonly MAX_DISCOVERRED = 99;
  private readonly MAX_PREFERENCE = 999;
  private readonly MAX_SEENPOSTS = 9999;
  private readonly posts: DocCollection<PostDoc>;
  private readonly contentCabinets: DocCollection<ContentCabinetDoc>;

  constructor(posts: DocCollection<PostDoc>, contentCabinets: DocCollection<ContentCabinetDoc>) {
    this.posts = posts;
    this.contentCabinets = contentCabinets;
  }

  async create(user: ObjectId) {
    await this.canCreate(user);
    // create a new discovery for the user
    const _id = await this.discoveries.createOne({ user, discoverred: [] });
    // if the user has not seen any posts, create a new seenPost doc
    const seenPost = await this.seenPosts.readOne({ user });
    if (!seenPost) {
      const cabinet = await this.contentCabinets.readOne({ owner: user });
      const preference = cabinet?.tags.slice(0, this.MAX_PREFERENCE) ?? [];
      await this.seenPosts.createOne({ user, preference, seen: [] });
    }
    // populate the discovery with posts
    const discoverred = await this.discoverPosts(user, this.MAX_DISCOVERRED);
    await this.update(_id, { discoverred });
    return { msg: "Discovery successfully created!", discovery: await this.discoveries.readOne({ _id }) };
  }

  async getByUser(user: ObjectId) {
    const discovery = await this.discoveries.readOne({ user });
    if (!discovery) {
      throw new NotFoundError(`Discovery for user ${user} does not exist!`);
    }
    return discovery;
  }

  async getDiscoverredPosts(user: ObjectId) {
    const discovery = await this.discoveries.readOne({ user });
    if (!discovery) {
      throw new NotFoundError(`User ${user} has not discovered any posts!`);
    }
    let posts = await this.posts.readMany({ _id: { $in: discovery.discoverred } });
    if (posts.length === 0) {
      throw new ReachingEndOfDiscoveryError(user);
    } else if (posts.length < this.MAX_DISCOVERRED) {
      // populate the discoery with more posts
      const toAdd = await this.discoverPosts(user, this.MAX_DISCOVERRED - posts.length);
      posts = posts.concat(await this.posts.readMany({ _id: { $in: toAdd } }));
      await this.discoveries.updateOne({ user }, { discoverred: discovery.discoverred.concat(toAdd) });
    }
    return posts;
  }

  async getSeenPosts(user: ObjectId) {
    const seenPost = await this.seenPosts.readOne({ user });
    if (!seenPost || seenPost.seen.length === 0) {
      throw new NotFoundError(`User ${user} has not seen any posts!`);
    }
    const posts = await this.posts.readMany({ _id: { $in: seenPost.seen } });
    return posts;
  }

  async update(_id: ObjectId, update: Partial<DiscoveryDoc>) {
    this.sanitizeUpdate(update);
    await this.discoveries.updateOne({ _id }, update);
    return { msg: "Discovery successfully updated!" };
  }

  async addPostToSeen(user: ObjectId, seen: ObjectId) {
    const seenPost = await this.seenPosts.readOne({ user });
    if (!seenPost) {
      throw new NotFoundError(`User ${user} has not seen any posts!`);
    }
    if (seenPost.seen.length + 1 > this.MAX_SEENPOSTS) {
      // pop the oldest seen post
      await this.seenPosts.updateOne({ user }, { seen: seenPost.seen.slice(0, this.MAX_SEENPOSTS - 1) });
    }
    // add the new seen post to the front
    await this.seenPosts.updateOne({ user }, { seen: [seen].concat(seenPost.seen) });
    return { msg: "Seen posts successfully updated!" };
  }

  async removePostFromSeen(user: ObjectId, seen: ObjectId) {
    const seenPost = await this.seenPosts.readOne({ user });
    if (!seenPost) {
      throw new NotFoundError(`User ${user} has not seen any posts!`);
    }
    if (!seenPost.seen.includes(seen)) {
      throw new NotAllowedError(`User ${user} has not seen post ${seen}!`);
    } else {
      await this.seenPosts.updateOne({ user }, { seen: seenPost.seen.filter((s) => s.toString() !== seen.toString()) });
    }
    return { msg: "Seen posts successfully updated!" };
  }

  async addTagToPreference(user: ObjectId, tag: ObjectId) {
    const seenPost = await this.seenPosts.readOne({ user });
    if (!seenPost) {
      throw new NotFoundError(`User ${user} has not seen any posts!`);
    }
    if (seenPost.preference.length === this.MAX_PREFERENCE) {
      await this.sortPreference(user);
      await this.seenPosts.updateOne({ user }, { preference: seenPost.preference.slice(0, this.MAX_PREFERENCE - 1) });
    }
    if (seenPost.preference.includes(tag)) {
      throw new NotAllowedError(`User ${user} already has tag ${tag} in preference!`);
    }
    await this.seenPosts.updateOne({ user }, { preference: seenPost.preference.concat([tag]) });
    return { msg: "Preference successfully updated!" };
  }

  async removeTagFromPreference(user: ObjectId, tag: ObjectId) {
    const seenPost = await this.seenPosts.readOne({ user });
    if (!seenPost) {
      throw new NotFoundError(`User ${user} has not seen any posts!`);
    }
    await this.seenPosts.updateOne({ user }, { preference: seenPost.preference.filter((t) => t !== tag) });
    return { msg: "Preference successfully updated!" };
  }

  async delete(_id: ObjectId) {
    await this.discoveries.deleteOne({ _id });
    return { msg: "Discovery deleted successfully!" };
  }

  async isUser(user: ObjectId, _id: ObjectId) {
    const discovery = await this.discoveries.readOne({ _id });
    if (!discovery) {
      throw new NotFoundError(`Discovery ${_id} does not exist!`);
    }
    if (discovery.user.toString() !== user.toString()) {
      throw new NotAllowedError(`User ${user} is not the owner of discovery ${_id}!`);
    }
  }

  // ############################################################
  // # Helper functions
  // ############################################################

  /**
   * Purpose: Get a list of posts that the user has not seen
   * Principle: return the number of num posts that the user has not seen
   * based on the user's preference
   */
  private async discoverPosts(user: ObjectId, num: number) {
    const seenPost = await this.seenPosts.readOne({ user });
    if (!seenPost) {
      throw new NotFoundError(`User ${user} has not seen any posts!`);
    }
    const seen = seenPost.seen;
    // get posts that the user has not seen and that match the user's preference
    // Note: the posts are sorted by dateUpdated in descending order
    // TODO: better recommendation algorithm
    const posts = await this.posts.readMany(
      { author: { $ne: user }, _id: { $nin: seen }, tags: { $in: seenPost.preference } },
      {
        sort: { dateUpdated: -1 },
        limit: num,
      },
    );
    if (posts) {
      return posts.map((post) => post._id);
    }
    return [];
  }

  private async canCreate(user: ObjectId) {
    const discovery = await this.discoveries.readOne({ user });
    if (discovery) {
      throw new NotAllowedError(`Discovery for user ${user} already exists!`);
    }
  }

  /**
   * Sort the user's preference by the number of times the user has seen posts with the tag
   * @param user
   */
  private async sortPreference(user: ObjectId) {
    const seenPost = await this.seenPosts.readOne({ user });
    if (!seenPost) {
      throw new NotFoundError(`User ${user} has not seen any posts!`);
    }
    const preference = seenPost.preference;
    const sorted = preference.sort((a, b) => {
      const aCount = seenPost.seen.filter((post) => this.posts.readOne({ post }).then((post) => post?.tags.includes(a))).length;
      const bCount = seenPost.seen.filter((post) => this.posts.readOne({ post }).then((post) => post?.tags.includes(b))).length;
      return aCount - bCount;
    });
    await this.seenPosts.updateOne({ user }, { preference: sorted });
  }

  private sanitizeUpdate(update: Partial<DiscoveryDoc>) {
    // Make sure the update cannot change the user.
    const allowedUpdates = ["discoverred"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }
}

export class ReachingEndOfDiscoveryError extends NotFoundError {
  constructor(public readonly user: ObjectId) {
    super("User {0} has reached the end of discovery!", user);
  }
}
