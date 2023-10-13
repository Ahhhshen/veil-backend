import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { ContentCabinet, Discovery, Friend, Meetup, Post, Tag, TimeLimitedEngagement, User, WebSession } from "./app";
import { PostDoc, PostOptions } from "./concepts/post";
import { TagDoc } from "./concepts/tag";
import { UserDoc } from "./concepts/user";
import { WebSessionDoc } from "./concepts/websession";
import Responses from "./responses";

class Routes {
  // ########################################################
  // User & Session Routes
  @Router.get("/session")
  async getSessionUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await User.getUsers();
  }

  @Router.get("/users/:username")
  async getUser(username: string) {
    return await User.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: WebSessionDoc, username: string, password: string) {
    WebSession.isLoggedOut(session);
    return await User.create(username, password);
  }

  @Router.patch("/users")
  async updateUser(session: WebSessionDoc, update: Partial<UserDoc>) {
    const user = WebSession.getUser(session);
    return await User.update(user, update);
  }

  @Router.delete("/users")
  async deleteUser(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    WebSession.end(session);
    return await User.delete(user);
  }

  @Router.post("/login")
  async logIn(session: WebSessionDoc, username: string, password: string) {
    const u = await User.authenticate(username, password);
    WebSession.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: WebSessionDoc) {
    WebSession.end(session);
    return { msg: "Logged out!" };
  }

  // ########################################################
  // Content Cabinet Routes
  // ########################################################
  @Router.get("/cabinet")
  async getContentCabinet(username?: string) {
    if (username) {
      const user = await User.getUserByUsername(username);
      return await Responses.contentCabinet(await ContentCabinet.getByOwner(user._id));
    } else {
      // get all content cabinets
      return await Responses.contentCabinets(await ContentCabinet.getContentCabinets({}));
    }
  }

  @Router.get("/cabinet/contents")
  async getContentCabinetContents(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const cabinet = await ContentCabinet.getByOwner(user);
    // Note: now contents are only posts
    const posts = cabinet.contents.map((content_id) => Post.getById(content_id));
    return Responses.posts(await Promise.all(posts));
  }

  @Router.post("/cabinet")
  async createContentCabinet(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const created = await ContentCabinet.create(user);
    return { msg: created.msg, contentCabinet: created.contentCabinet };
  }

  @Router.patch("/cabinet/veil/:content_id")
  async veilContent(session: WebSessionDoc, content_id: ObjectId) {
    const user = WebSession.getUser(session);
    // Note: now contents are only posts
    await Post.isAuthor(user, content_id);
    return await Post.update(content_id, { isVeiled: true });
  }

  @Router.patch("/cabinet/unveil/:content_id")
  async unveilContent(session: WebSessionDoc, content_id: ObjectId) {
    const user = WebSession.getUser(session);
    // Note: now contents are only posts
    await Post.isAuthor(user, content_id);
    return await Post.update(content_id, { isVeiled: false });
  }

  @Router.delete("/cabinet")
  async deleteContentCabinet(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const cabinet = await ContentCabinet.getByOwner(user);
    // delete all contents in the cabinet
    // Note: now contents are only posts
    await Promise.all(cabinet.contents.map((content_id) => Post.delete(content_id)));
    // delete all tags in the cabinet
    await Promise.all(cabinet.tags.map((tag_id) => this.deleteTag(session, tag_id)));
    // delete the cabinet itself
    return await ContentCabinet.delete(cabinet._id);
  }

  @Router.delete("/cabinet/content/:content_id")
  async removeContentFromCabinet(session: WebSessionDoc, content_id: ObjectId) {
    const user = WebSession.getUser(session);
    // Note: now contents are only posts
    await Post.isAuthor(user, content_id);
    const removed = await ContentCabinet.removeContent(user, content_id);
    await this.deletePost(session, content_id);
    return { msg: removed.msg };
  }

  // ########################################################
  // Post Routes
  // ########################################################
  @Router.get("/posts")
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await User.getUserByUsername(author))._id;
      posts = await Post.getByAuthor(id);
    } else {
      posts = await Post.getPosts({});
    }
    return Responses.posts(posts);
  }

  @Router.post("/posts")
  async createPost(session: WebSessionDoc, content: string, options?: PostOptions) {
    const user = WebSession.getUser(session);
    const created = await Post.create(user, content, options);
    const post = created.post;
    if (post) {
      // Add this post to the user's content cabinet
      await ContentCabinet.addContent(user, post._id);
      return { msg: created.msg, post };
    }
  }

  @Router.patch("/posts/:_id")
  async updatePost(session: WebSessionDoc, _id: ObjectId, update: Partial<PostDoc>) {
    const user = WebSession.getUser(session);
    await Post.isAuthor(user, _id);
    return await Post.update(_id, update);
  }

  @Router.delete("/posts/:_id")
  async deletePost(session: WebSessionDoc, _id: ObjectId) {
    const user = WebSession.getUser(session);
    // Remove this post from the user's content cabinet
    // Note: now contents are only posts
    await Post.isAuthor(user, _id);
    await ContentCabinet.removeContent(user, _id);
    // Remove the post from all tags
    const post = await Post.getById(_id);
    if (post && post.tags.length > 0) {
      post.tags.forEach(async (tag) => {
        await Tag.removePosts(tag, [_id]);
      });
    }
    // Delete the post
    return Post.delete(_id);
  }

  // ########################################################
  // Tag Routes
  // ########################################################
  @Router.post("/tags/:name/:post_id")
  async createTag(session: WebSessionDoc, name: string, post_id: ObjectId) {
    const user = WebSession.getUser(session);
    const created = await Tag.create(user, name, [post_id]);
    // Sync the tag with the posts and user's content cabinet
    const tag = await Responses.tag(created.tag);
    if (tag) {
      // Add this tag to the post's tags
      tag.taggedposts.forEach(async (post) => {
        await Post.addTag(post, tag._id);
      });
      // Add this tag to the user's content cabinet
      await ContentCabinet.addTag(user, tag._id);
      // Add this tag to the user's discovery's preference
      await Discovery.addTagToPreference(user, tag._id);
    }
    return { msg: created.msg, tag };
  }

  @Router.put("/tag/:_id/:post_id")
  async addTagToPost(session: WebSessionDoc, _id: ObjectId, post_id: ObjectId) {
    const user = WebSession.getUser(session);
    await Tag.isAuthor(user, _id);
    // Add this tag to the post's tags
    await Post.addTag(post_id, _id);
    // Add this post to the tag's taggedposts
    await Tag.addPosts(_id, [post_id]);
    // Add this tag to the user's content cabinet
    await ContentCabinet.addTag(user, _id);
    return await Responses.post(await Post.getById(post_id));
  }

  @Router.get("/tags")
  async getUserTags(username?: string) {
    let tags;
    if (username) {
      const user = await User.getUserByUsername(username);
      tags = await Tag.getByAuthor(user._id);
    } else {
      tags = await Tag.getTags({});
    }
    return await Responses.tags(tags);
  }

  @Router.get("/tags/:post_id")
  async getPostTags(post_id: ObjectId) {
    const post = await Post.getById(post_id);
    if (post) {
      const tags = await Tag.getTags({ _id: { $in: post.tags } });
      return await Responses.tags(tags);
    }
  }

  @Router.get("/tag/:id")
  async getTag(id: ObjectId) {
    return await Responses.tag(await Tag.getById(id));
  }

  @Router.patch("/tags/:id")
  async updateTag(session: WebSessionDoc, id: ObjectId, update: Partial<TagDoc>) {
    const user = WebSession.getUser(session);
    await Tag.isAuthor(user, id);
    return await Tag.update(id, update);
  }

  @Router.delete("/tags/:id")
  async deleteTag(session: WebSessionDoc, id: ObjectId) {
    const user = WebSession.getUser(session);
    await Tag.isAuthor(user, id);
    // Remove this tag from the user's content cabinet and all posts
    const tag = await Tag.getById(id);
    if (tag) {
      // remove this tag from all posts
      tag.taggedposts.forEach(async (post) => {
        await Post.removeTag(post, tag._id);
      });
      // remove this tag from the user's content cabinet
      await ContentCabinet.removeTag(user, tag._id);
      // remove this tag from the user's discovery's preference
      await Discovery.removeTagFromPreference(user, tag._id);
    }
    return await Tag.delete(id);
  }

  // ########################################################
  // Discovery Routes
  // ########################################################
  @Router.post("/discoveries")
  async createDiscovery(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    const created = await Discovery.create(user);
    return { msg: created.msg, discovery: created.discovery };
  }

  @Router.get("/discoveries/:numberOfPosts")
  async discoverNewPosts(session: WebSessionDoc, numberOfPosts?: number) {
    const user = WebSession.getUser(session);
    const posts = await Discovery.getDiscoverredPosts(user);
    const posts_to_update = posts.slice(0, numberOfPosts);
    return await Responses.posts(posts_to_update);
  }

  @Router.get("/discovery/seen")
  async getSeenPosts(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Responses.posts(await Discovery.getSeenPosts(user));
  }

  @Router.patch("/discovery/seen/:post_id")
  async addPostToSeen(session: WebSessionDoc, post_id: ObjectId) {
    const user = WebSession.getUser(session);
    return await Discovery.addPostToSeen(user, post_id);
  }

  @Router.delete("/discoveries")
  async deleteDiscovery(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Discovery.delete(user);
  }

  @Router.delete("/discovery/seen/:post_id")
  async removePostFromSeen(session: WebSessionDoc, post_id: ObjectId) {
    const user = WebSession.getUser(session);
    return await Discovery.removePostFromSeen(user, post_id);
  }

  // ########################################################
  // Friend Routes
  // ########################################################
  @Router.get("/friends")
  async getFriends(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await User.idsToUsernames(await Friend.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: WebSessionDoc, friend: string) {
    const user = WebSession.getUser(session);
    const friendId = (await User.getUserByUsername(friend))._id;
    return await Friend.removeFriend(user, friendId);
  }

  @Router.get("/friend/requests")
  async getRequests(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Responses.friendRequests(await Friend.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    return await Friend.sendRequest(user, toId);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    return await Friend.removeRequest(user, toId);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Friend.acceptRequest(fromId, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Friend.rejectRequest(fromId, user);
  }

  // ########################################################
  // Meetup Routes
  // ########################################################
  @Router.get("/meetups")
  async getMeetups(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Meetup.getMeetups(user);
  }

  @Router.delete("/meetups/:friend")
  async removeMeetup(session: WebSessionDoc, friend: string) {
    const user = WebSession.getUser(session);
    const friendId = (await User.getUserByUsername(friend))._id;
    return await Meetup.removeMeetup(user, friendId);
  }

  @Router.get("/meetup/invitations")
  async getInvitations(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await Meetup.getInvitations(user);
  }

  @Router.post("/meetup/invitation/:to")
  async sendInvitation(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    return await Meetup.sendInvitation(user, toId);
  }

  @Router.delete("/meetup/invitation/:to")
  async removeInvitation(session: WebSessionDoc, to: string) {
    const user = WebSession.getUser(session);
    const toId = (await User.getUserByUsername(to))._id;
    return await Meetup.removeInvitation(user, toId);
  }

  @Router.put("/meetup/accept/:from")
  async acceptInvitation(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Meetup.acceptInvitation(fromId, user);
  }

  @Router.put("/meetup/reject/:from")
  async rejectInvitation(session: WebSessionDoc, from: string) {
    const user = WebSession.getUser(session);
    const fromId = (await User.getUserByUsername(from))._id;
    return await Meetup.rejectInvitation(fromId, user);
  }

  // ########################################################
  // Time-limited Engagement Routes
  // ########################################################
  @Router.get("/timelimitedengagements")
  async getTimeLimitedEngagements(session: WebSessionDoc) {
    const user = WebSession.getUser(session);
    return await TimeLimitedEngagement.getByUser(user);
  }

  @Router.post("/timelimitedengagement/:content_id")
  async setTimeLimitedEngagement(session: WebSessionDoc, content_id: ObjectId, time: string) {
    const user = WebSession.getUser(session);
    // Note: now contents are only posts
    await Post.isAuthor(user, content_id);
    // parse time string
    const date = new Date(time);
    return await TimeLimitedEngagement.setEngagement(user, content_id, date);
  }

  @Router.delete("/timelimitedengagement/:content_id")
  async removeTimeLimitedEngagement(session: WebSessionDoc, content_id: ObjectId) {
    const user = WebSession.getUser(session);
    return await TimeLimitedEngagement.removeEngagement(user, content_id);
  }
}

export default getExpressRouter(new Routes());
