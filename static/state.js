export const state = {
  topics: [], activeTopicId: "", metrics: null, videos: [], mapsPlaces: [], mapsFeed: [], socialPosts: [], socialStats: null, health: null, usage: null,
  activeSource: "overview", videoType: "", videoSort: "gain", suggestion: null, charts: {}, streamConnected: false,
  sourceStates: {
    youtube: { loading: false, loaded: false, error: "" },
    maps: { loading: false, loaded: false, error: "" },
    social: { loading: false, loaded: false, error: "" },
  },
};
