import { CspPolicies, ImageSrc } from "@main/csp";

// Last.fm image CDNs (avatars and album covers). The API now returns
// lastfm-img.*; the older host is kept for cached or legacy URLs.
CspPolicies["lastfm-img.freetls.fastly.net"] = ImageSrc;
CspPolicies["lastfm.freetls.fastly.net"] = ImageSrc;
