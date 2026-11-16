import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { PERIODS } from "./api";

export const settings = definePluginSettings({
    username: {
        description: "last.fm username",
        type: OptionType.STRING,
    },
    apiKey: {
        description: "last.fm api key",
        type: OptionType.STRING,
    },
    period: {
        description: "Time range used for top tracks, albums and artists",
        type: OptionType.SELECT,
        options: PERIODS.map(period => ({
            label: period.label,
            value: period.value,
            default: period.value === "7day"
        })),
    },
    itemLimit: {
        description: "Number of items shown in each list",
        type: OptionType.SLIDER,
        markers: [10, 20, 30, 40, 50],
        default: 20,
        stickToMarkers: true,
    }
});
