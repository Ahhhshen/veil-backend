import FriendConcept from "./concepts/friend";
import PostConcept from "./concepts/post";
import UserConcept from "./concepts/user";
import WebSessionConcept from "./concepts/websession";
import TagConcept from "./concepts/tag";
import DiscoveryConcept from "./concepts/discovery";
import MeetupConcept from "./concepts/meetup";
import TimeLimitedEngagementConcept from "./concepts/timelimitedengagement";

// App Definition using concepts
export const WebSession = new WebSessionConcept();
export const User = new UserConcept();
export const Post = new PostConcept();
export const Friend = new FriendConcept();
export const Tag = new TagConcept();
export const Discovery = new DiscoveryConcept();
export const Meetup = new MeetupConcept();
export const TimeLimitedEngagement = new TimeLimitedEngagementConcept();
