var STORAGE_KEY = "metro-calendar-settings";
var ACCENTS = require("./accents").map(function (accent) { return accent.value; });
var settings = {
  lightMode: false,
  accent: "default",
  showWeather: false,
  skipAllDay: true,
};
var calendarSubscription = null;
var weatherSubscription = null;
var calendarInstances = [];
var calendarState = "loading";
var selectedEvents = [];
var weather = null;
var isReady = false;
var pushTimer = null;
var Clay = require("@rebble/clay");
var clayConfig = require("./config");
var clay = new Clay(clayConfig, require("./custom-clay"), { autoHandleEvents: false });

function validAccent(value) {
  return value === "default" || ACCENTS.indexOf(value) >= 0;
}

function log(message) {
  console.log("[Metro Calendar] " + message);
}

function loadSettings() {
  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    var parsed = JSON.parse(stored);
    if (parsed && typeof parsed.lightMode === "boolean") settings.lightMode = parsed.lightMode;
    if (parsed && validAccent(parsed.accent)) settings.accent = parsed.accent;
    if (parsed && typeof parsed.showWeather === "boolean") {
      settings.showWeather = parsed.showWeather;
    }
    if (parsed && typeof parsed.skipAllDay === "boolean") {
      settings.skipAllDay = parsed.skipAllDay;
    }
  } catch (error) {
    log("stored settings could not be read; using defaults");
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function shortText(property) {
  if (!property) return "";
  var shape = property.longText || property.shortText;
  if (!shape || typeof shape.text !== "string") return "";
  return shape.text.trim();
}

function timestamp(property) {
  var shape = property && property.timestamp;
  if (!shape || typeof shape.value !== "number" || !isFinite(shape.value)) return null;
  var milliseconds = shape.value * 1000;
  return milliseconds > 0 ? milliseconds : null;
}

function formatTime(milliseconds) {
  var date = new Date(milliseconds);
  return String(date.getHours()).padStart(2, "0") + ":" +
    String(date.getMinutes()).padStart(2, "0");
}

function eventDay(milliseconds) {
  var date = new Date(milliseconds);
  var today = new Date();
  if (date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() && date.getDate() === today.getDate()) {
    return "";
  }
  return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getDay()] + " ";
}

function eventFromInstance(instance) {
  if (!instance || !instance.properties) return null;
  var properties = instance.properties;
  var allDayShape = properties.all_day && properties.all_day.boolean;
  if (!allDayShape || typeof allDayShape.value !== "boolean") return null;

  var title = shortText(properties.name);
  var startsAt = timestamp(properties.starts_at);
  var endsAt = timestamp(properties.ends_at);
  if (!title || startsAt === null || endsAt === null || endsAt <= Date.now()) return null;

  if (allDayShape.value) {
    if (settings.skipAllDay) return null;
    return {
      title: title,
      start: startsAt,
      when: (startsAt <= Date.now() ? "" : eventDay(startsAt)) + "ALL DAY",
      kind: "all-day",
    };
  }

  var startLabel = properties.starts_at.shortText &&
    properties.starts_at.shortText.text;
  if (typeof startLabel !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startLabel)) {
    startLabel = formatTime(startsAt);
  }
  return {
    title: title,
    start: startsAt,
    when: startsAt <= Date.now() ? "NOW" : eventDay(startsAt) + startLabel,
    kind: startsAt <= Date.now() ? "current" : "timed",
  };
}

function chooseEvents() {
  var upcoming = [];
  for (var i = 0; i < calendarInstances.length; i++) {
    var candidate = eventFromInstance(calendarInstances[i]);
    if (candidate) upcoming.push(candidate);
  }
  upcoming.sort(function (a, b) { return a.start - b.start; });
  selectedEvents = upcoming.slice(0, 3);
  calendarState = selectedEvents.length ? "ready" : "empty";
  schedulePush();
}

function sendToWatch() {
  if (!isReady) return;
  var first = selectedEvents[0];
  var second = selectedEvents[1];
  var third = selectedEvents[2];
  Pebble.sendAppMessage({
    EVENT_STATE: calendarState,
    EVENT_TITLE: first ? first.title.slice(0, 40) : "",
    EVENT_WHEN: first ? first.when : "",
    EVENT_KIND: first ? first.kind : "",
    EVENT_TITLE_2: second ? second.title.slice(0, 40) : "",
    EVENT_WHEN_2: second ? second.when : "",
    EVENT_TITLE_3: third ? third.title.slice(0, 40) : "",
    EVENT_WHEN_3: third ? third.when : "",
    SHOW_WEATHER: settings.showWeather ? 1 : 0,
    WEATHER_TEMP: weather ? weather.temperature : "",
    WEATHER_CONDITION: weather ? weather.condition.slice(0, 48) : "",
    LIGHT_MODE: settings.lightMode ? 1 : 0,
    ACCENT_COLOR: settings.accent,
  }, function () {}, function (error) {
    log("watch update failed: " + (error && error.message ? error.message : "unknown error"));
  });
}

function schedulePush() {
  if (pushTimer !== null) return;
  pushTimer = setTimeout(function () {
    pushTimer = null;
    sendToWatch();
  }, 80);
}

function onCalendarData(envelope) {
  calendarInstances = envelope && Array.isArray(envelope.instances) ?
    envelope.instances : [];
  chooseEvents();
}

function onCalendarError(error) {
  calendarState = "unavailable";
  selectedEvents = [];
  schedulePush();
  log("calendar source unavailable: " + (error && error.code ? error.code : "unknown"));
}

function subscribeCalendar() {
  if (calendarSubscription) calendarSubscription.unsubscribe();
  calendarSubscription = Pebble.subscribeToSource({
    category: "calendar",
    item: "event",
    properties: ["name", "starts_at", "ends_at", "all_day"],
    onData: onCalendarData,
    onError: onCalendarError,
  });
}

function clearWeather() {
  if (weatherSubscription) {
    weatherSubscription.unsubscribe();
    weatherSubscription = null;
  }
  weather = null;
  schedulePush();
}

function subscribeWeather() {
  clearWeather();
  if (!settings.showWeather) return;
  weatherSubscription = Pebble.subscribeToSource({
    category: "weather",
    item: "location",
    properties: ["temperature", "condition"],
    onData: function (envelope) {
      var first = envelope && envelope.instances && envelope.instances[0];
      var properties = first && first.properties;
      var temperature = properties && shortText(properties.temperature);
      var condition = properties && shortText(properties.condition);
      if (!temperature || !condition) {
        weather = null;
      } else {
        weather = {
          temperature: temperature,
          condition: condition,
        };
      }
      schedulePush();
    },
    onError: function (error) {
      weather = null;
      schedulePush();
      log("weather source unavailable: " + (error && error.code ? error.code : "unknown"));
    },
  });
}

function applyClaySettings(response) {
  var values;
  try {
    values = clay.getSettings(response, false);
  } catch (error) {
    log("settings response could not be read");
    return;
  }
  var light = values.LIGHT_MODE && values.LIGHT_MODE.value;
  if (typeof light === "boolean" || light === 0 || light === 1) {
    settings.lightMode = light === true || light === 1;
  }
  var accent = values.ACCENT_COLOR && values.ACCENT_COLOR.value;
  if (validAccent(accent)) settings.accent = accent;
  var showWeather = values.SHOW_WEATHER && values.SHOW_WEATHER.value;
  if (typeof showWeather === "boolean" || showWeather === 0 || showWeather === 1) {
    settings.showWeather = showWeather === true || showWeather === 1;
  }
  var skipAllDay = values.SKIP_ALL_DAY && values.SKIP_ALL_DAY.value;
  if (typeof skipAllDay === "boolean" || skipAllDay === 0 || skipAllDay === 1) {
    settings.skipAllDay = skipAllDay === true || skipAllDay === 1;
  }
  saveSettings();
  chooseEvents();
  subscribeWeather();
}

Pebble.addEventListener("ready", function () {
  isReady = true;
  loadSettings();
  subscribeCalendar();
  subscribeWeather();
  schedulePush();
});

Pebble.addEventListener("appmessage", function (event) {
  if (event.payload && event.payload.HELLO) schedulePush();
});

Pebble.addEventListener("showConfiguration", function () {
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener("webviewclosed", function (event) {
  if (event && event.response) applyClaySettings(event.response);
});
