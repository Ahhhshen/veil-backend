import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
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

  constructor(private readonly posts: DocCollection<PostDoc>) {
    this.posts = posts;
  }

  async create(user: ObjectId, preference: ObjectId[]) {
    // create a new discovery for the user
    const _id = await this.discoveries.createOne({ user, discoverred: [] });
    // populate the discovery with posts
    const discoverred = await this.discoverPosts(user, preference, this.MAX_DISCOVERRED);
    await this.update(_id, { discoverred });
    // if the user has not seen any posts, create a new seenPost doc
    const seenPost = await this.seenPosts.readOne({ user });
    if (!seenPost) {
      await this.seenPosts.createOne({ user, seen: [] });
    }
    return { msg: "Discovery successfully created!", discovery: await this.discoveries.readOne({ _id }) };
  }

  async getDiscoverredPosts(user: ObjectId) {
    const posts = await this.discoveries.readMany({ user });
    if (posts.length === 0) {
      throw new ReachingEndOfDiscoveryError(user);
    }
  }

  async getSeenPosts(user: ObjectId) {
    return await this.seenPosts.readMany({ user });
  }

  async update(_id: ObjectId, update: Partial<DiscoveryDoc>) {
    this.sanitizeUpdate(update);
    await this.discoveries.updateOne({ _id }, update);
    return { msg: "Discovery successfully updated!" };
  }

  async updateSeenPosts(user: ObjectId, seen: ObjectId[]) {
    const seenPost = await this.seenPosts.readOne({ user });
    if (!seenPost) {
      throw new NotFoundError(`User ${user} has not seen any posts!`);
    }
    if (seenPost.seen.length + seen.length > this.MAX_SEENPOSTS) {
      // pop the oldest seen posts
      const numToRemove = seenPost.seen.length + seen.length - this.MAX_SEENPOSTS;
      const seenToRemove = seenPost.seen.slice(0, numToRemove);
      await this.seenPosts.updateOne({ user }, { seen: seenPost.seen.slice(numToRemove).concat(seen) });
      // remove the seen posts from the discovery
      const discovery = await this.discoveries.readOne({ user });
      if (!discovery || discovery.discoverred.length === 0) {
        throw new NotFoundError(`User ${user} has not discovered any posts!`);
      }
      const removed = discovery.discoverred.filter((post) => !seenToRemove.includes(post));
      // add new posts to the discovery
      const toAdd = await this.discoverPosts(user, seenPost.preference, numToRemove);
      await this.discoveries.updateOne({ user }, { discoverred: removed.concat(toAdd) });
    } else {
      await this.seenPosts.updateOne({ user }, { seen: seenPost.seen.concat(seen) });
    }
    return { msg: "Seen posts successfully updated!" };
  }

  async updatePreference(user: ObjectId, preference: ObjectId[]) {
    // TODO: remove the tags in the preference that have low frequency
  }

  async delete(_id: ObjectId) {
    await this.discoveries.deleteOne({ _id });
    return { msg: "Discovery deleted successfully!" };
  }

  /**
   * Purpose: Get a list of posts that the user has not seen
   * Principle: return the first MAX_DISCOVERRED posts that the user has not seen
   * based on the user's preference
   */
  private async discoverPosts(user: ObjectId, preference: ObjectId[], num: number) {
    const seenPost = await this.seenPosts.readOne({ user });
    if (!seenPost) {
      throw new NotFoundError(`User ${user} has not seen any posts!`);
    }
    const seen = seenPost.seen;
    // get posts that the user has not seen and that match the user's preference
    // Note: the posts are sorted by dateUpdated in descending order
    // TODO: better recommendation algorithm
    const posts = await this.posts.readMany(
      { _id: { $nin: seen }, tags: { $in: preference } },
      {
        sort: { dateUpdated: -1 },
        limit: num,
      },
    );
    return posts.map((post) => post._id);
  }

  /**
   * Sort the user's preference by the number of times the user has seen posts with the tag
   * @param user
   */
  private async sortPreference(user: ObjectId) {}

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
