import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    username: {
        description: "last.fm username",
        type: OptionType.STRING,
    },
    apiKey: {
        description: "last.fm api key",
        type: OptionType.STRING,
    }
});
