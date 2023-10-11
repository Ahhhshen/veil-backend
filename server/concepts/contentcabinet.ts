import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface ContentCabinetDoc extends BaseDoc {
  owner: ObjectId; // the user who owns the content cabinet, each user can only have one
  contents: ObjectId[]; // the contents in the cabinet, ordered by date added, now is
  // a set of posts, could add other types of content in the future
  tags: ObjectId[]; // the tags that the user has added to the cabinet's contents
}

export default class ContentCabinetConcept {
  public readonly contentCabinets = new DocCollection<ContentCabinetDoc>("contentCabinets");

  async create(owner: ObjectId) {
    await this.canCreate(owner);
    const _id = await this.contentCabinets.createOne({ owner, contents: [] });
    return { msg: "Content cabinet successfully created!", contentCabinet: await this.contentCabinets.readOne({ _id }) };
  }

  async getByOwner(owner: ObjectId) {
    const contentCabinet = await this.contentCabinets.readOne({ owner });
    if (!contentCabinet) {
      throw new NotFoundError(`Content cabinet for user ${owner} does not exist!`);
    }
    return contentCabinet;
  }

  async addContent(owner: ObjectId, content_id: ObjectId) {
    const contentCabinet = await this.contentCabinets.readOne({ owner });
    if (!contentCabinet) {
      throw new NotFoundError(`Content cabinet for user ${owner} does not exist!`);
    }
    if (contentCabinet.contents.includes(content_id)) {
      throw new NotAllowedError(`Content ${content_id} already exists in the cabinet!`);
    }
    await this.contentCabinets.updateOne({ owner }, { contents: contentCabinet.contents.concat([content_id]) });
    return { msg: "Content successfully added!" };
  }

  async removeContent(owner: ObjectId, content_id: ObjectId) {
    const contentCabinet = await this.contentCabinets.readOne({ owner });
    if (!contentCabinet) {
      throw new NotFoundError(`Content cabinet for user ${owner} does not exist!`);
    }
    if (contentCabinet.contents.includes(content_id)) {
      await this.contentCabinets.updateOne({ owner }, { contents: contentCabinet.contents.filter((c) => c !== content_id) });
    }
    return { msg: "Content successfully removed!" };
  }

  async addTags(owner: ObjectId, tags: ObjectId[]) {
    const contentCabinet = await this.contentCabinets.readOne({ owner });
    if (!contentCabinet) {
      throw new NotFoundError(`Content cabinet for user ${owner} does not exist!`);
    }
    const newTags = tags.filter((tag) => !contentCabinet.tags.includes(tag));
    if (newTags) {
      await this.contentCabinets.updateOne({ owner }, { tags: contentCabinet.tags.concat(newTags) });
    }

    return { msg: "Tags successfully added!" };
  }

  async removeTags(owner: ObjectId, tags: ObjectId[]) {
    const contentCabinet = await this.contentCabinets.readOne({ owner });
    if (!contentCabinet) {
      throw new NotFoundError(`Content cabinet for user ${owner} does not exist!`);
    }
    const newTags = contentCabinet.tags.filter((tag) => !tags.includes(tag));
    await this.contentCabinets.updateOne({ owner }, { tags: newTags });
    return { msg: "Tags successfully removed!" };
  }

  async update(_id: ObjectId, update: Partial<ContentCabinetDoc>) {
    this.sanitizeUpdate(update);
    await this.contentCabinets.updateOne({ _id }, update);
    return { msg: "Content cabinet successfully updated!" };
  }

  async delete(_id: ObjectId) {
    await this.contentCabinets.deleteOne({ _id });
    return { msg: "Content cabinet deleted successfully!" };
  }

  async isOwner(user: ObjectId, _id: ObjectId) {
    const contentCabinet = await this.contentCabinets.readOne({ _id });
    if (!contentCabinet) {
      throw new NotFoundError(`Content cabinet ${_id} does not exist!`);
    }
    if (contentCabinet.owner.toString() !== user.toString()) {
      throw new ContentCabinetOwnerNotMatchError(user, _id);
    }
  }

  private async canCreate(owner: ObjectId) {
    const contentCabinet = await this.contentCabinets.readOne({ owner });
    if (contentCabinet) {
      throw new NotAllowedError(`Content cabinet for user ${owner} already exists!`);
    }
  }

  private sanitizeUpdate(update: Partial<ContentCabinetDoc>) {
    // Make sure the update cannot change the owner.
    const allowedUpdates = ["content"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update ${key}!`);
      }
    }
  }
}

export class ContentCabinetOwnerNotMatchError extends NotAllowedError {
  constructor(user: ObjectId, _id: ObjectId) {
    super(`User ${user} is not the owner of content cabinet ${_id}!`);
  }
}
