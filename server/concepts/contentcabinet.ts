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
  private readonly MAX_TAGS = 999;

  async create(owner: ObjectId) {
    await this.canCreate(owner);
    const _id = await this.contentCabinets.createOne({ owner, contents: [], tags: [] });
    return { msg: "Content cabinet successfully created!", contentCabinet: await this.contentCabinets.readOne({ _id }) };
  }

  async getByOwner(owner: ObjectId) {
    const contentCabinet = await this.contentCabinets.readOne({ owner });
    if (!contentCabinet) {
      throw new NotFoundError(`Content cabinet for user ${owner} does not exist!`);
    }
    return contentCabinet;
  }

  async getContentCabinets(query: Partial<ContentCabinetDoc>) {
    const contentCabinets = await this.contentCabinets.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return contentCabinets;
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

    const newContents = contentCabinet.contents.filter((c) => c.toString() !== content_id.toString());
    await this.update(contentCabinet._id, { contents: newContents });
    return { msg: "Content successfully removed!" };
  }

  async addTag(owner: ObjectId, tag: ObjectId) {
    const contentCabinet = await this.contentCabinets.readOne({ owner });
    if (!contentCabinet) {
      throw new NotFoundError(`Content cabinet for user ${owner} does not exist!`);
    }
    if (contentCabinet.tags.length >= this.MAX_TAGS) {
      throw new NotAllowedError(`Content cabinet already has ${this.MAX_TAGS} tags!`);
    } else {
      try {
        await this.isNotTagged(contentCabinet._id, tag);
      } catch (e) {
        return { msg: "Content cabinet already has this tag!" };
      }
    }
    await this.contentCabinets.updateOne({ owner }, { tags: contentCabinet.tags.concat([tag]) });

    return { msg: "Tags successfully added!" };
  }

  async removeTag(owner: ObjectId, tag: ObjectId) {
    const contentCabinet = await this.contentCabinets.readOne({ owner });
    if (!contentCabinet) {
      throw new NotFoundError(`Content cabinet for user ${owner} does not exist!`);
    }
    const newTags = contentCabinet.tags.filter((t) => t.toString() !== tag.toString());
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
    const allowedUpdates = ["contents", "tags"];
    for (const key in update) {
      if (!allowedUpdates.includes(key)) {
        throw new NotAllowedError(`Cannot update ${key}!`);
      }
    }
  }

  private async isNotTagged(_id: ObjectId, tag: ObjectId) {
    const contentCabinet = await this.contentCabinets.readOne({ _id });
    if (!contentCabinet) {
      throw new NotFoundError(`Content cabinet ${_id} does not exist!`);
    }
    // Stringify the ObjectId to compare.
    const cabinetTags = contentCabinet.tags.map((t) => t.toString());
    if (cabinetTags.includes(tag.toString())) {
      throw new NotAllowedError(`Content cabinet ${_id} already has tag ${tag}!`);
    }
  }
}

export class ContentCabinetOwnerNotMatchError extends NotAllowedError {
  constructor(user: ObjectId, _id: ObjectId) {
    super(`User ${user} is not the owner of content cabinet ${_id}!`);
  }
}
