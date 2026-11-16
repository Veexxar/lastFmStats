import { CspPolicies, ImageSrc } from "@main/csp";

// Last.fm image CDN (avatars and album covers)
CspPolicies["lastfm.freetls.fastly.net"] = ImageSrc;
