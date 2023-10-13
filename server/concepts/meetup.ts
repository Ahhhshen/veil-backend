import { ObjectId } from "mongodb";
import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";
import { FriendshipDoc } from "./friend";

export interface MeetupDoc extends BaseDoc {
  attendee1: ObjectId;
  attendee2: ObjectId;
  name: string;
  type: "Virtual" | "In-Person";
  date: Date;
  location: string;
}

export interface MeetupInvitationDoc extends BaseDoc {
  from: ObjectId;
  to: ObjectId;
  status: "pending" | "rejected" | "accepted";
}

export default class MeetupConcept {
  public readonly meetups = new DocCollection<MeetupDoc>("meetups");
  public readonly invitations = new DocCollection<MeetupInvitationDoc>("meetupInvitations");

  constructor(private readonly friends: DocCollection<FriendshipDoc>) {
    this.friends = friends;
  }

  async getInvitations(user: ObjectId) {
    return await this.invitations.readMany({
      $or: [{ from: user }, { to: user }],
    });
  }

  async sendInvitation(from: ObjectId, to: ObjectId) {
    await this.canSendInvitation(from, to);
    await this.invitations.createOne({ from, to, status: "pending" });
    return { msg: "Sent invitation!" };
  }

  async acceptInvitation(from: ObjectId, to: ObjectId) {
    await this.removePendingInvitation(from, to);
    // Following two can be done in parallel, thus we use `void`
    void this.invitations.createOne({ from, to, status: "accepted" });
    void this.addMeetup(from, to);
    return { msg: "Accepted invitation!" };
  }

  async rejectInvitation(from: ObjectId, to: ObjectId) {
    await this.removePendingInvitation(from, to);
    await this.invitations.createOne({ from, to, status: "rejected" });
    return { msg: "Rejected invitation!" };
  }

  async removeInvitation(from: ObjectId, to: ObjectId) {
    await this.removePendingInvitation(from, to);
    return { msg: "Removed invitation!" };
  }

  async removeMeetup(user: ObjectId, friend: ObjectId) {
    const meetup = await this.meetups.popOne({
      $or: [
        { attendee1: user, attendee2: friend },
        { attendee1: friend, attendee2: user },
      ],
    });
    if (meetup === null) {
      throw new MeetupNotFoundError(user, friend);
    }
    return { msg: "Removed meetup!" };
  }

  async getMeetups(user: ObjectId) {
    const meetups = await this.meetups.readMany({
      $or: [{ attendee1: user }, { attendee2: user }],
    });
    return meetups;
  }

  async setMeetupInfo(user: ObjectId, friend: ObjectId, name?: string, type?: "Virtual" | "In-Person", date?: Date, location?: string) {
    const meetup = await this.meetups.readOne({
      $or: [
        { attendee1: user, attendee2: friend },
        { attendee1: friend, attendee2: user },
      ],
    });
    if (meetup === null) {
      throw new MeetupNotFoundError(user, friend);
    }
    if (name === undefined && type === undefined && date === undefined && location === undefined) {
      throw new NotAllowedError("No meetup info provided!");
    }
    await this.meetups.updateOne({ _id: meetup._id }, { name, type, date, location });
    return { msg: "Updated meetup info!" };
  }

  // ########################################
  // # Helpers
  // ########################################

  private async addMeetup(attendee1: ObjectId, attendee2: ObjectId) {
    void this.meetups.createOne({ attendee1, attendee2, name: "", type: "Virtual", date: new Date(), location: "" });
  }

  private async removePendingInvitation(from: ObjectId, to: ObjectId) {
    const invitation = await this.invitations.popOne({ from, to, status: "pending" });
    if (invitation === null) {
      throw new InvitationNotFoundError(from, to);
    }
  }

  private async isFriend(attendee1: ObjectId, attendee2: ObjectId) {
    const friendship = await this.friends.readOne({
      $or: [
        { user1: attendee1, user2: attendee2 },
        { user1: attendee2, user2: attendee1 },
      ],
    });
    if (!friendship) {
      throw new NotAllowedError(`Users ${attendee1} and ${attendee2} are not friends!`);
    }
  }

  private async canSendInvitation(attendee1: ObjectId, attendee2: ObjectId) {
    await this.isFriend(attendee1, attendee2);
    // Make sure the invitation does not already exist
    const invitation = await this.invitations.readOne({
      from: { $in: [attendee1, attendee2] },
      to: { $in: [attendee1, attendee2] },
      status: "pending",
    });
    if (invitation !== null) {
      throw new MeetupInvitationAlreadyExistsError(attendee1, attendee2);
    }
  }
}

export class MeetupNotFoundError extends NotFoundError {
  constructor(
    public readonly attendee1: ObjectId,
    public readonly attendee2: ObjectId,
  ) {
    super("Meetup between {0} and {1} does not exist!", attendee1, attendee2);
  }
}

export class InvitationNotFoundError extends NotFoundError {
  constructor(
    public readonly from: ObjectId,
    public readonly to: ObjectId,
  ) {
    super("Invitation from {0} to {1} does not exist!", from, to);
  }
}

export class MeetupInvitationAlreadyExistsError extends NotAllowedError {
  constructor(
    public readonly from: ObjectId,
    public readonly to: ObjectId,
  ) {
    super("Invitation between {0} and {1} already exists!", from, to);
  }
}
