import { Filter, ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface PostOptions {
  backgroundColor?: string;
}

export interface PostDoc extends BaseDoc {
  author: ObjectId;
  content: string;
  tags: ObjectId[];
  options?: PostOptions;
  isExpired: boolean;
}

export default class PostConcept {
  public readonly posts = new DocCollection<PostDoc>("posts");

  async create(author: ObjectId, content: string, options?: PostOptions) {
    await this.canCreate(author, content);
    const _id = await this.posts.createOne({ author, content, tags: [], options, isExpired: false });
    return { msg: "Post successfully created!", post: await this.posts.readOne({ _id }) };
  }

  async getPosts(query: Filter<PostDoc>) {
    const posts = await this.posts.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return posts;
  }

  async getByAuthor(author: ObjectId) {
    return await this.getPosts({ author });
  }

  async getById(_id: ObjectId) {
    const post = await this.posts.readOne({ _id });
    if (!post) {
      throw new NotFoundError(`Post ${_id} does not exist!`);
    }
    return post;
  }

  async getByTag(tag_id: ObjectId) {
    const tag = await this.getPosts({ tag_id: { $in: [tag_id] } });
    if (!tag) {
      throw new NotFoundError(`Tag ${tag} does not exist!`);
    }
    return tag;
  }

  async addTags(_id: ObjectId, tags: ObjectId[]) {
    const post = await this.posts.readOne({ _id });
    if (!post) {
      throw new NotFoundError(`Post ${_id} does not exist!`);
    }
    const newTags = tags.filter((tag) => !post.tags.includes(tag));
    if (newTags.length > 0) {
      await this.posts.updateOne({ _id }, { tags: post.tags?.concat(newTags) });
    }
    return { msg: "Tags successfully added!" };
  }

  async removeTags(_id: ObjectId, tags: ObjectId[]) {
    const post = await this.posts.readOne({ _id });
    if (!post) {
      throw new NotFoundError(`Post ${_id} does not exist!`);
    }
    const newTags = post.tags.filter((tag) => !tags.includes(tag));
    await this.posts.updateOne({ _id }, { tags: newTags });
    return { msg: "Tags successfully removed!" };
  }

  async update(_id: ObjectId, update: Partial<PostDoc>) {
    this.sanitizeUpdate(update);
    await this.posts.updateOne({ _id }, update);
    return { msg: "Post successfully updated!" };
  }

  async delete(_id: ObjectId) {
    await this.posts.deleteOne({ _id });
    return { msg: "Post deleted successfully!" };
  }

  async isAuthor(user: ObjectId, _id: ObjectId) {
    const post = await this.posts.readOne({ _id });
    if (!post) {
      throw new NotFoundError(`Post ${_id} does not exist!`);
    }
    if (post.author.toString() !== user.toString()) {
      throw new PostAuthorNotMatchError(user, _id);
    }
  }

  private async canCreate(author: ObjectId, content: string) {
    if (content.length === 0) {
      throw new NotAllowedError(`Post content cannot be empty!`);
    }
  }

  private sanitizeUpdate(update: Partial<PostDoc>) {
    // Make sure the update cannot change the author.
    const allowedUpdates = ["content", "options"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update '${key}' field!`);
      }
    }
  }
}

export class PostAuthorNotMatchError extends NotAllowedError {
  constructor(
    public readonly author: ObjectId,
    public readonly _id: ObjectId,
  ) {
    super("{0} is not the author of post {1}!", author, _id);
  }
}
