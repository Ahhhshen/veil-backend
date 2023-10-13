import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface TimeLimitedEngagementDoc extends BaseDoc {
  content: ObjectId; // the post that is being engaged with
  owner: ObjectId; // the owner of the post
  dateExpires: Date; // the date the engagement will expire
}

export default class TimeLimitedEngagementConcept {
  public readonly timeLimitedEngagements = new DocCollection<TimeLimitedEngagementDoc>("timeLimitedEngagements");

  async create(content: ObjectId, owner: ObjectId, dateExpires: Date) {
    const _id = await this.timeLimitedEngagements.createOne({ content, owner, dateExpires });
    return { msg: "Time limited engagement successfully created!", timeLimitedEngagement: await this.timeLimitedEngagements.readOne({ _id }) };
  }

  async getByUser(owner: ObjectId) {
    return await this.getEngagements({ owner });
  }

  async setEngagement(user: ObjectId, content: ObjectId, dateExpires: Date) {
    try {
      await this.canCreate(content, user, dateExpires);
    } catch (err) {
      if (err instanceof EngagementAlreadyExistsError) {
        // if the user already has an engagement with the content, update the dateExpires
        const engagement = await this.timeLimitedEngagements.readOne({ content, owner: user });
        if (!engagement) {
          throw new NotFoundError(`Engagement already exists, but cannot be found!`);
        }
        await this.timeLimitedEngagements.updateOne({ _id: engagement._id }, { dateExpires });
        return { msg: "Engagement successfully updated!" };
      }
      throw err;
    }
    await this.create(content, user, dateExpires);
    return { msg: "Engagement successfully set!" };
  }

  async removeEngagement(user: ObjectId, content: ObjectId) {
    const engagement = await this.timeLimitedEngagements.readOne({ content, owner: user });
    if (!engagement) {
      throw new NotFoundError(`Engagement does not exist!`);
    }
    await this.timeLimitedEngagements.deleteOne({ _id: engagement._id });
    return { msg: "Engagement successfully removed!" };
  }

  private async getEngagements(query: Partial<TimeLimitedEngagementDoc>) {
    const engagements = await this.timeLimitedEngagements.readMany(query, {
      sort: { dateUpdated: -1 },
    });
    return engagements;
  }

  private async canCreate(content: ObjectId, owner: ObjectId, dateExpires: Date) {
    // make sure the dateExpires is in the future
    if (dateExpires < new Date()) {
      throw new NotAllowedError(`The engagement must expire in the future!`);
    }
    // make sure the owner does not have any other engagements with the same content
    const engagement = await this.timeLimitedEngagements.readOne({ content, owner });
    if (engagement) {
      throw new EngagementAlreadyExistsError(owner, content);
    }
  }
}

export class EngagementAlreadyExistsError extends NotAllowedError {
  constructor(
    private readonly owner: ObjectId,
    private readonly content: ObjectId,
  ) {
    super(`User ${owner} already set time-limited engagement with content ${content}!`);
  }
}
