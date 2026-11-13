const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

process.env.TZ = "UTC";
const source = fs.readFileSync(path.join(__dirname, "../src/pkjs/index.js"), "utf8");
const now = Date.parse("2026-11-12T10:00:00Z");

test("watch message key order matches Pebble package metadata", () => {
  const watch = fs.readFileSync(path.join(__dirname, "../src/embeddedjs/main.js"), "utf8");
  const keys = watch.match(/keys:\s*\[([\s\S]*?)\]/)[1].match(/"[^"]+"/g)
    .map((key) => JSON.parse(key));
  const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
  assert.deepEqual(keys, metadata.pebble.messageKeys);
});

function harness() {
  const messages = [];
  const timers = [];
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
    static now() { return now; }
  }
  const context = {
    Date: FixedDate,
    console,
    setTimeout: (callback) => { timers.push(callback); return timers.length; },
    localStorage: { getItem: () => null, setItem: () => {} },
    require: (name) => {
      if (name === "@rebble/clay") return class {};
      if (name === "./accents") return require("../src/pkjs/accents");
      if (name === "./custom-clay") return require("../src/pkjs/custom-clay");
      return [];
    },
    Pebble: {
      addEventListener: () => {},
      sendAppMessage: (message) => messages.push(message),
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.isReady = true;
  return {
    context,
    messages,
    flush: () => { while (timers.length) timers.shift()(); },
  };
}

function event(title, start, end, allDay) {
  const properties = {
    name: { longText: { text: title } },
    starts_at: { timestamp: { value: Date.parse(start) / 1000 } },
    ends_at: { timestamp: { value: Date.parse(end) / 1000 } },
  };
  if (allDay !== undefined) properties.all_day = { boolean: { value: allDay } };
  return { properties };
}

test("sends the first three eligible events in chronological order", () => {
  const h = harness();
  h.context.onCalendarData({ instances: [
    event("Tomorrow", "2026-11-13T09:00:00Z", "2026-11-13T10:00:00Z", false),
    event("Later", "2026-11-12T12:00:00Z", "2026-11-12T13:00:00Z", false),
    event("Now", "2026-11-12T09:30:00Z", "2026-11-12T10:30:00Z", false),
    event("Next", "2026-11-12T11:00:00Z", "2026-11-12T11:30:00Z", false),
    event("Expired", "2026-11-12T08:00:00Z", "2026-11-12T09:00:00Z", false),
    event("Malformed", "2026-11-12T10:00:00Z", "2026-11-12T11:00:00Z"),
  ] });
  h.flush();
  const message = h.messages.at(-1);
  assert.deepEqual(
    [message.EVENT_TITLE, message.EVENT_TITLE_2, message.EVENT_TITLE_3],
    ["Now", "Next", "Later"],
  );
  assert.deepEqual(
    [message.EVENT_WHEN, message.EVENT_WHEN_2, message.EVENT_WHEN_3],
    ["NOW", "11:00", "12:00"],
  );
});

test("accent choices match the archive and watch, with theme default", () => {
  const options = require("../src/pkjs/config").find((item) => item.type === "section")
    .items.find((item) => item.messageKey === "ACCENT_COLOR").options;
  const expected = [
    "#A3C315", "#5EA81E", "#00890A", "#00AAA8", "#1EA1E0",
    "#0F51ED", "#6B0FFD", "#AA0FFD", "#F472CE", "#D70472",
    "#A10124", "#E41502", "#F96707", "#EFA216", "#D7C014",
    "#81592C", "#6C8664", "#637586", "#756089", "#9F512D",
  ];
  assert.deepEqual(options.map((option) => option.value), ["default", ...expected]);
  const watch = fs.readFileSync(path.join(__dirname, "../src/embeddedjs/main.js"), "utf8");
  assert.deepEqual(watch.match(/const accents = \[([\s\S]*?)\]/)[1].match(/"#[0-9A-F]{6}"/g)
    .map(JSON.parse), expected);
});

test("clock labels use the selected accent and calendar text stays neutral in both themes", () => {
  const drawn = [];
  const circles = [];
  class Poco {
    constructor(screen) { this.width = screen.width; this.height = screen.height; }
    makeColor(r, g, b) { return `${r},${g},${b}`; }
    getTextWidth(text, font) { return text.length * font.height * 0.46; }
    drawText(text, font, color, x, y) { drawn.push({ text, font, color, x, y }); }
    begin() {}
    end() {}
    fillRectangle() {}
    drawLine() {}
    drawCircle(color, x, y) { circles.push({ color, x, y }); }
  }
  Poco.prototype.Font = class { constructor() { this.height = 14; } };
  const context = {
    Poco,
    screen: { width: 200, height: 228, round: false },
    parseBMF: (resource) => ({ height: Number(resource.name.match(/-(\d+)\.fnt$/)[1]) }),
    parseRLE: () => ({}),
    Resource: class { constructor(name) { this.name = name; } },
    Message: class {},
    watch: { hour12: true, addEventListener() {} },
  };
  vm.createContext(context);
  const watch = fs.readFileSync(path.join(__dirname, "../src/embeddedjs/main.js"), "utf8")
    .replace(/^import .*;\r?\n/gm, "");
  vm.runInContext(watch, context);
  for (const { value } of require("../src/pkjs/accents")) {
    const rgb = value.match(/[0-9A-F]{2}/g).map((channel) => parseInt(channel, 16));
    for (const light of [false, true]) {
      drawn.length = 0;
      context.updateFromPhone(new Map([
        ["ACCENT_COLOR", value],
        ["LIGHT_MODE", Number(light)],
        ["EVENT_TITLE", "Design review"],
        ["EVENT_WHEN", "10:30"],
      ]));
      drawn.length = 0;
      const neutral = light ? "0,0,0" : "255,255,255";
      for (const [hour, period] of [[11, "AM"], [23, "PM"]]) {
        drawn.length = 0;
        context.draw(new Date(`2026-11-12T${hour}:38:00Z`));
        assert.equal(drawn.find((entry) => entry.text === "11:38").color, neutral, `${value} time`);
        assert.equal(drawn.find((entry) => entry.text === "12").color, neutral, `${value} day`);
        assert.equal(drawn.find((entry) => entry.text === period).color, rgb.join(","), `${value} ${period}`);
        assert.equal(drawn.find((entry) => entry.text === "THU").color, rgb.join(","), `${value} weekday`);
      }
      assert.equal(drawn.find((entry) => entry.text === "CALENDAR").color, neutral);
      assert.equal(drawn.find((entry) => entry.text === "10:30").color, neutral);
    }
  }
  drawn.length = 0;
  context.draw(new Date("2026-11-12T11:38:00Z"));
  const twelveHour = drawn.find((entry) => entry.text === "11:38");
  assert.equal(twelveHour.font.height, 42);
  context.watch.hour12 = false;
  drawn.length = 0;
  context.draw(new Date("2026-11-12T23:38:00Z"));
  const twentyFourHour = drawn.find((entry) => entry.text === "23:38");
  assert.equal(twentyFourHour.font.height, 48);
  assert.equal(twentyFourHour.y, twelveHour.y + 8);
  assert.equal(drawn.some((entry) => entry.text === "PM"), false);
  vm.runInContext("screen.round = true; render.width = 260; render.height = 260;", context);
  drawn.length = 0;
  context.draw(new Date("2026-11-12T23:38:00Z"));
  const roundClock = drawn.find((entry) => entry.text === "23:38");
  assert.equal(roundClock.font.height, 48);
  assert.ok(roundClock.y + roundClock.font.height < Math.round(260 * 0.44));
  vm.runInContext("screen.round = false; render.width = 200; render.height = 228;", context);
  drawn.length = 0;
  circles.length = 0;
  context.updateFromPhone(new Map([
    ["SHOW_WEATHER", 1],
    ["WEATHER_TEMP", "72F"],
    ["WEATHER_CONDITION", "Sunny"],
    ["EVENT_TITLE_3", "Third"],
    ["EVENT_WHEN_3", "15:30"],
  ]));
  const temperature = drawn.find((entry) => entry.text === "72F");
  assert.ok(temperature);
  assert.equal(drawn.some((entry) => entry.text === "Sunny"), false);
  const thirdEvent = drawn.find((entry) => entry.text === "Third");
  assert.ok(thirdEvent);
  assert.ok(thirdEvent.y + thirdEvent.font.height < temperature.y);
  const iconLeft = circles[0].x - 15;
  const groupRight = temperature.x + temperature.font.height * 0.46 * 3;
  assert.ok(Math.abs((iconLeft + groupRight) / 2 - 100) <= 0.5);
  vm.runInContext("screen.round = true; render.width = 260; render.height = 260;", context);
  drawn.length = 0;
  circles.length = 0;
  context.draw(new Date("2026-11-12T23:38:00Z"));
  const roundTemperature = drawn.find((entry) => entry.text === "72F");
  const roundThird = drawn.find((entry) => entry.text === "Third");
  assert.ok(roundThird.y + roundThird.font.height < roundTemperature.y);
  const roundIconLeft = circles[0].x - 15;
  const roundGroupRight = roundTemperature.x + roundTemperature.font.height * 0.46 * 3;
  const bottom = Math.round(260 * 0.82) + 27;
  for (const x of [roundIconLeft, roundGroupRight]) {
    assert.ok(Math.hypot(x - 130, bottom - 130) < 125);
  }
});

test("valid accents persist and invalid settings fall back without losing defaults", () => {
  const h = harness();
  let stored = JSON.stringify({ lightMode: true, accent: "#F96707" });
  h.context.localStorage = { getItem: () => stored, setItem: (_, value) => { stored = value; } };
  h.context.loadSettings();
  assert.equal(h.context.settings.lightMode, true);
  assert.equal(h.context.settings.accent, "#F96707");
  h.context.sendToWatch();
  assert.equal(h.messages.at(-1).ACCENT_COLOR, "#F96707");
  assert.equal(h.messages.at(-1).LIGHT_MODE, 1);
  h.context.settings.accent = "default";
  stored = JSON.stringify({ accent: "#123456" });
  h.context.loadSettings();
  assert.equal(h.context.settings.accent, "default");
});

test("light mode defaults to dark for missing and older settings", () => {
  const h = harness();
  h.context.localStorage = { getItem: () => JSON.stringify({ theme: "light" }) };
  h.context.loadSettings();
  h.context.sendToWatch();
  assert.equal(h.context.settings.lightMode, false);
  assert.equal(h.messages.at(-1).LIGHT_MODE, 0);
});

test("Clay response updates and saves the chosen settings", () => {
  const h = harness();
  let saved;
  h.context.localStorage.setItem = (_, value) => { saved = JSON.parse(value); };
  h.context.clay.getSettings = (_, convert) => {
    assert.equal(convert, false);
    return {
      LIGHT_MODE: { value: true },
      ACCENT_COLOR: { value: "#D70472" },
      SHOW_WEATHER: { value: true },
      SKIP_ALL_DAY: { value: false },
    };
  };
  h.context.subscribeWeather = () => {};
  h.context.applyClaySettings("response");
  h.flush();
  assert.equal(saved.lightMode, true);
  assert.equal(saved.accent, "#D70472");
  assert.equal(saved.showWeather, true);
  assert.equal(saved.skipAllDay, false);
  assert.equal(h.messages.at(-1).LIGHT_MODE, 1);
  assert.equal(h.messages.at(-1).ACCENT_COLOR, "#D70472");
});

test("preview follows the accent without trusting invalid color values", () => {
  const values = { ACCENT_COLOR: "default" };
  const handlers = {};
  let preview;
  const items = Object.fromEntries(Object.keys(values).map((key) => [key, {
    get: () => values[key],
    on: (_, handler) => { handlers[key] = handler; },
  }]));
  const clay = {
    EVENTS: { AFTER_BUILD: "ready" },
    on: (_, handler) => handler(),
    getItemByMessageKey: (key) => items[key],
    getItemById: () => ({ set: (html) => { preview = html; } }),
  };
  require("../src/pkjs/custom-clay").call(clay);
  assert.match(preview, /#1EA1E0/);
  values.ACCENT_COLOR = "#F96707";
  handlers.ACCENT_COLOR();
  assert.match(preview, /#F96707/);
  values.ACCENT_COLOR = '"><script>';
  handlers.ACCENT_COLOR();
  assert.match(preview, /#1EA1E0/);
  assert.doesNotMatch(preview, /<script>/);
});

test("all-day setting, future weekdays and cleared rows are reflected in updates", () => {
  const h = harness();
  const allDay = event("Holiday", "2026-11-13T00:00:00Z", "2026-11-14T00:00:00Z", true);
  const timed = event("Tomorrow", "2026-11-13T09:00:00Z", "2026-11-13T10:00:00Z", false);
  h.context.onCalendarData({ instances: [timed, allDay] });
  h.flush();
  assert.equal(h.messages.at(-1).EVENT_WHEN, "FRI 09:00");
  h.context.settings.skipAllDay = false;
  h.context.chooseEvents();
  h.flush();
  assert.equal(h.messages.at(-1).EVENT_WHEN, "FRI ALL DAY");
  assert.equal(h.messages.at(-1).EVENT_TITLE_2, "Tomorrow");
  h.context.onCalendarData({ instances: [] });
  h.flush();
  assert.equal(h.messages.at(-1).EVENT_STATE, "empty");
  assert.equal(h.messages.at(-1).EVENT_TITLE, "");
  assert.equal(h.messages.at(-1).EVENT_TITLE_2, "");
  assert.equal(h.messages.at(-1).EVENT_TITLE_3, "");
});
