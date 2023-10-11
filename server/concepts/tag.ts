import { Filter, ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface TagDoc extends BaseDoc {
  author: ObjectId;
  name: string;
  taggedposts: ObjectId[];
}

export default class TagConcept {
  public readonly tags = new DocCollection<TagDoc>("tags");

  async create(author: ObjectId, name: string, posts: ObjectId[]) {
    await this.canCreate(author, name, posts);
    const _id = await this.tags.createOne({ author, name, taggedposts: posts });
    return { msg: "Tag created successfully!", tag: await this.tags.readOne({ _id }) };
  }

  async getByAuthor(author: ObjectId) {
    return await this.getTags({ author });
  }

  async getById(_id: ObjectId) {
    const tag = await this.tags.readOne({ _id });
    if (!tag) {
      throw new NotFoundError(`Tag ${_id} does not exist!`);
    }
    return tag;
  }

  async addPosts(_id: ObjectId, posts: ObjectId[]) {
    /** Add the posts to the taggedposts of the _id tag */
    const tag = await this.tags.readOne({ _id });
    if (!tag) {
      throw new NotFoundError(`Tag ${_id} does not exist!`);
    }
    const newPosts = posts.filter((post) => !tag.taggedposts.includes(post));
    if (newPosts.length > 0) {
      await this.tags.updateOne({ _id }, { taggedposts: tag.taggedposts.concat(newPosts) });
    }
    return { msg: "Posts successfully added!" };
  }

  async removePosts(_id: ObjectId, posts: ObjectId[]) {
    /** Remove the posts from the taggedposts of the _id tag */
    const tag = await this.tags.readOne({ _id });
    if (!tag) {
      throw new NotFoundError(`Tag ${_id} does not exist!`);
    }
    const newPosts = tag.taggedposts.filter((post) => !posts.includes(post));
    if (newPosts.length >= 0) {
      await this.tags.updateOne({ _id }, { taggedposts: newPosts });
    }
    return { msg: "Posts successfully removed!" };
  }

  async update(_id: ObjectId, update: Partial<TagDoc>) {
    this.sanitizeUpdate(update);
    await this.tags.updateOne({ _id }, update);
    return { msg: "Tag successfully updated!" };
  }

  async delete(_id: ObjectId) {
    await this.tags.deleteOne({ _id });
    return { msg: "Tag deleted successfully!" };
  }

  async isAuthor(user: ObjectId, _id: ObjectId) {
    const tag = await this.tags.readOne({ _id });
    if (!tag) {
      throw new NotFoundError(`Tag ${_id} does not exist!`);
    }
    if (tag.author.toString() !== user.toString()) {
      throw new TagAuthorNotMatchError(user, _id);
    }
  }

  private async getTags(query: Filter<TagDoc>) {
    const tags = await this.tags.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return tags;
  }

  private sanitizeUpdate(update: Partial<TagDoc>) {
    // Make sure the update cannot change the author.
    const allowedUpdates = ["name", "posts"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update ${key}!`);
      }
    }
  }

  private async canCreate(author: ObjectId, name: string, posts: ObjectId[]) {
    if (!name) {
      throw new NotAllowedError(`Tag name cannot be empty!`);
    }
    if (posts.length === 0) {
      throw new NotAllowedError(`Tag must have at least one post!`);
    }
    const authorTags = await this.getByAuthor(author);
    const existingTag = authorTags.find((tag) => tag.name === name);
    if (existingTag) {
      throw new NotAllowedError(`Tag ${name} already created by ${author}!`);
    }
  }
}

export class TagAuthorNotMatchError extends NotAllowedError {
  constructor(
    public readonly author: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the author of tag {1}!", author, _id);
  }
}
