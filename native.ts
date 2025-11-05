import { CspPolicies, ImageSrc } from "@main/csp";

CspPolicies["lastfm.freetls.fastly.net"] = ImageSrc;
CspPolicies["*.last.fm"] = ImageSrc;
