var accents = require("./accents");

module.exports = [
  {
    type: "heading",
    defaultValue: "Metro Calendar",
  },
  {
    type: "text",
    defaultValue: "Choose the watchface palette and optional data to display.",
  },
  {
    type: "section",
    items: [
      {
        type: "toggle",
        messageKey: "LIGHT_MODE",
        label: "Light mode",
        defaultValue: false,
      },
      {
        type: "select",
        messageKey: "ACCENT_COLOR",
        label: "Accent color",
        defaultValue: "default",
        options: [{ label: "Theme default", value: "default" }].concat(
          accents.map(function (accent) {
            return { label: accent.label + " - " + accent.value, value: accent.value };
          })
        ),
      },
      {
        type: "text",
        id: "accent-preview",
        defaultValue: "Accent preview",
      },
      {
        type: "toggle",
        messageKey: "SHOW_WEATHER",
        label: "Show current weather (plugin)",
        defaultValue: false,
      },
      {
        type: "toggle",
        messageKey: "SKIP_ALL_DAY",
        label: "Skip all-day events",
        defaultValue: true,
      },
    ],
  },
  {
    type: "submit",
    defaultValue: "Save Settings",
  },
];
