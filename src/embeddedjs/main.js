import Poco from "commodetto/Poco";
import parseBMF from "commodetto/parseBMF";
import parseRLE from "commodetto/parseRLE";
import Message from "pebble/message";

const render = new Poco(screen);
const tallTimeFont = loadFont("selawk", 48);
const timeFont = loadFont("selawk", 42);
const compactTimeFont = loadFont("selawk", 36);
const dateFont = loadFont("selawk", 36);
const labelFont = new render.Font("Gothic-Bold", 14);
const smallLabelFont = labelFont;
const bodyFont = new render.Font("Gothic-Regular", 14);
const temperatureFont = new render.Font("Gothic-Bold", 18);
const accents = [
  "#A3C315", "#5EA81E", "#00890A", "#00AAA8", "#1EA1E0",
  "#0F51ED", "#6B0FFD", "#AA0FFD", "#F472CE", "#D70472",
  "#A10124", "#E41502", "#F96707", "#EFA216", "#D7C014",
  "#81592C", "#6C8664", "#637586", "#756089", "#9F512D",
];
const themes = [
  {
    background: render.makeColor(0, 0, 0),
    foreground: render.makeColor(255, 255, 255),
    muted: render.makeColor(170, 170, 170),
    accent: render.makeColor(30, 161, 224),
  },
  {
    background: render.makeColor(255, 255, 255),
    foreground: render.makeColor(0, 0, 0),
    muted: render.makeColor(85, 85, 85),
    accent: render.makeColor(30, 161, 224),
  },
];

let lastDate = new Date();
let eventState = "loading";
let eventTitle = "";
let eventWhen = "";
let eventTitle2 = "";
let eventWhen2 = "";
let eventTitle3 = "";
let eventWhen3 = "";
let showWeather = false;
let weatherTemperature = "";
let weatherCondition = "";
let lightMode = false;
let accentColor = "default";

function loadFont(name, size) {
  const font = parseBMF(new Resource(`${name}-${size}.fnt`));
  font.bitmap = parseRLE(new Resource(`${name}-${size}-alpha.bm4`));
  return font;
}

function messageValue(message, key) {
  const value = message.get(key);
  return value === undefined ? null : value;
}

function updateFromPhone(values) {
  const state = messageValue(values, "EVENT_STATE");
  if (typeof state === "string") eventState = state;

  const title = messageValue(values, "EVENT_TITLE");
  if (typeof title === "string") eventTitle = title;

  const when = messageValue(values, "EVENT_WHEN");
  if (typeof when === "string") eventWhen = when;

  const title2 = messageValue(values, "EVENT_TITLE_2");
  if (typeof title2 === "string") eventTitle2 = title2;
  const when2 = messageValue(values, "EVENT_WHEN_2");
  if (typeof when2 === "string") eventWhen2 = when2;
  const title3 = messageValue(values, "EVENT_TITLE_3");
  if (typeof title3 === "string") eventTitle3 = title3;
  const when3 = messageValue(values, "EVENT_WHEN_3");
  if (typeof when3 === "string") eventWhen3 = when3;

  const enabled = messageValue(values, "SHOW_WEATHER");
  if (typeof enabled === "number") showWeather = enabled === 1;

  const temperature = messageValue(values, "WEATHER_TEMP");
  if (typeof temperature === "string") weatherTemperature = temperature;

  const condition = messageValue(values, "WEATHER_CONDITION");
  if (typeof condition === "string") weatherCondition = condition;

  const light = messageValue(values, "LIGHT_MODE");
  if (typeof light === "number") lightMode = light === 1;

  const accent = messageValue(values, "ACCENT_COLOR");
  if (accent !== null) {
    accentColor = accent === "default" || accents.includes(accent) ? accent : "default";
  }

  draw(lastDate);
}

let message;
let helloPending = true;
message = new Message({
  keys: [
    "HELLO",
    "EVENT_STATE",
    "EVENT_TITLE",
    "EVENT_WHEN",
    "EVENT_KIND",
    "SHOW_WEATHER",
    "SKIP_ALL_DAY",
    "WEATHER_TEMP",
    "WEATHER_CONDITION",
    "COLOR_THEME",
    "EVENT_TITLE_2",
    "EVENT_WHEN_2",
    "EVENT_TITLE_3",
    "EVENT_WHEN_3",
    "ACCENT_COLOR",
    "LIGHT_MODE",
  ],
  onReadable() {
    updateFromPhone(this.read());
  },
  onWritable() {
    if (!helloPending) return;
    helloPending = false;
    message.write(new Map([["HELLO", 1]]));
  },
});

function safeWidthAt(y, font) {
  if (!screen.round) return render.width - 24;
  const radius = Math.min(render.width, render.height) / 2 - 5;
  const dx = y + font.height / 2 - render.height / 2;
  if (Math.abs(dx) >= radius) return 0;
  return Math.min(render.width - 24, 2 * Math.sqrt(radius * radius - dx * dx) - 24);
}

function fitText(text, font, maxWidth) {
  let value = String(text || "");
  if (render.getTextWidth(value, font) <= maxWidth) return value;
  const suffix = "...";
  while (value.length > 0 && render.getTextWidth(value + suffix, font) > maxWidth) {
    value = value.slice(0, -1);
  }
  return value.length > 0 ? value + suffix : "";
}

function drawCentered(text, font, color, y) {
  const value = fitText(text, font, safeWidthAt(y, font));
  if (!value) return;
  const x = Math.round((render.width - render.getTextWidth(value, font)) / 2);
  render.drawText(value, font, color, x, y);
}

function formatClock(date) {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const hour12 = watch.hour12;
  const displayHour = hour12 ? (hours % 12 || 12) : hours;
  return {
    text: `${hour12 ? displayHour : String(displayHour).padStart(2, "0")}:${minutes}`,
    period: hour12 ? (hours < 12 ? "AM" : "PM") : "",
  };
}

function drawClock(date, palette) {
  const clock = formatClock(date);
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const weekday = days[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const dateWidth = Math.max(render.getTextWidth(weekday, smallLabelFont),
    render.getTextWidth(day, dateFont)) + 8;
  const gap = clock.period ? 20 : 12;
  const top = Math.round(render.height * 0.16);
  const y = top + (clock.period ? 0 : screen.round ? 14 : 8);
  const fonts = clock.period ? [timeFont, compactTimeFont] :
    [tallTimeFont, timeFont, compactTimeFont];
  let font = fonts[fonts.length - 1];
  for (const candidate of fonts) {
    const safeWidth = Math.min(safeWidthAt(y - candidate.height / 2, candidate),
      safeWidthAt(y + candidate.height / 2, candidate));
    if (render.getTextWidth(clock.text, candidate) + gap + dateWidth <= safeWidth) {
      font = candidate;
      break;
    }
  }
  const width = render.getTextWidth(clock.text, font);
  const totalWidth = width + gap + dateWidth;
  const left = Math.round((render.width - totalWidth) / 2);
  render.drawText(clock.text, font, palette.foreground, left, y);
  if (clock.period) {
    render.drawText(clock.period, smallLabelFont, palette.accent,
      left + Math.round((width - render.getTextWidth(clock.period, smallLabelFont)) / 2),
      y + font.height - 2);
  }
  const dateLeft = left + width + gap;
  const dateTop = top - 3;
  render.drawText(weekday, smallLabelFont, palette.accent,
    dateLeft + Math.round((dateWidth - render.getTextWidth(weekday, smallLabelFont)) / 2),
    dateTop + 1);
  render.drawText(day, dateFont, palette.foreground,
    dateLeft + Math.round((dateWidth - render.getTextWidth(day, dateFont)) / 2),
    dateTop + smallLabelFont.height - 2);
}

function drawCloud(x, y, color) {
  render.drawCircle(color, x + 7, y + 11, 6, 0, 360);
  render.drawCircle(color, x + 15, y + 7, 8, 0, 360);
  render.drawCircle(color, x + 24, y + 11, 6, 0, 360);
  render.drawRoundRect(x + 4, y + 10, 23, 9, color, 4);
}

function drawWeatherIcon(x, y, palette) {
  const condition = weatherCondition.toLowerCase();
  if (["rain", "drizzle", "shower", "storm", "thunder"].some((part) =>
    condition.includes(part))) {
    drawCloud(x, y, palette.muted);
    render.drawLine(x + 9, y + 22, x + 6, y + 27, palette.accentText, 2);
    render.drawLine(x + 18, y + 22, x + 15, y + 27, palette.accentText, 2);
  } else if (["snow", "sleet", "hail", "ice", "freezing"].some((part) =>
    condition.includes(part))) {
    drawCloud(x, y, palette.muted);
    render.drawCircle(palette.accentText, x + 8, y + 25, 2, 0, 360);
    render.drawCircle(palette.accentText, x + 17, y + 25, 2, 0, 360);
  } else if (["cloud", "fog", "mist", "haze", "overcast"].some((part) =>
    condition.includes(part))) {
    drawCloud(x, y, palette.muted);
  } else if (["sun", "clear", "fair"].some((part) => condition.includes(part))) {
    render.drawCircle(palette.accentText, x + 15, y + 13, 7, 0, 360);
    render.drawLine(x + 15, y + 1, x + 15, y + 4, palette.accentText, 2);
    render.drawLine(x + 15, y + 22, x + 15, y + 25, palette.accentText, 2);
    render.drawLine(x + 3, y + 13, x + 6, y + 13, palette.accentText, 2);
    render.drawLine(x + 24, y + 13, x + 27, y + 13, palette.accentText, 2);
  } else {
    drawCloud(x, y, palette.muted);
  }
}

function drawTextAt(text, font, color, x, y, maxWidth) {
  const value = fitText(text, font, maxWidth);
  if (value) render.drawText(value, font, color, x, y);
}

function drawWeather(palette) {
  if (!showWeather || !weatherTemperature || !weatherCondition) return;
  const y = Math.round(render.height * 0.82);
  const rowWidth = safeWidthAt(y + 8, bodyFont);
  const iconWidth = 30;
  const gap = 8;
  const temperature = fitText(weatherTemperature, temperatureFont,
    Math.min(64, rowWidth - iconWidth - gap));
  if (!temperature) return;
  const tempWidth = render.getTextWidth(temperature, temperatureFont);
  const left = Math.round((render.width - iconWidth - gap - tempWidth) / 2);
  drawWeatherIcon(left, y, palette);
  render.drawText(temperature, temperatureFont, palette.foreground, left + iconWidth + gap, y + 4);
}

function drawEvent(title, when, palette, y) {
  const rowWidth = safeWidthAt(y, bodyFont);
  const left = Math.round((render.width - rowWidth) / 2);
  const timeWidth = Math.min(rowWidth * 0.46, render.getTextWidth("WED ALL DAY", labelFont));
  render.fillRectangle(palette.accent, left, y + 2, 4, bodyFont.height - 4);
  drawTextAt(when, labelFont, palette.foreground, left + 9, y, timeWidth);
  drawTextAt(title, bodyFont, palette.foreground, left + 14 + timeWidth, y,
    rowWidth - timeWidth - 14);
}

function draw(date) {
  lastDate = date || lastDate;
  const theme = themes[lightMode ? 1 : 0];
  let accent = theme.accent;
  const color = accentColor === "default" ? "#1EA1E0" : accentColor;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  if (accentColor !== "default") {
    accent = render.makeColor(r, g, b);
  }
  function linear(channel) {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  const contrast = lightMode ? 1.05 / (luminance + 0.05) :
    (luminance + 0.05) / 0.05;
  const accentText = contrast < 4.5 ? theme.foreground : accent;
  const palette = { ...theme, accent, accentText };
  render.begin();
  render.fillRectangle(palette.background, 0, 0, render.width, render.height);

  drawClock(lastDate, palette);

  const dividerY = Math.round(render.height * 0.44);
  const dividerWidth = safeWidthAt(dividerY, bodyFont) * 0.55;
  render.drawLine(
    Math.round((render.width - dividerWidth) / 2),
    dividerY,
    Math.round((render.width + dividerWidth) / 2),
    dividerY,
    palette.muted,
    1,
  );
  drawCentered("CALENDAR", labelFont, palette.foreground, Math.round(render.height * 0.46));

  if (eventTitle) {
    drawEvent(eventTitle, eventWhen, palette, Math.round(render.height * 0.54));
    if (eventTitle2) {
      drawEvent(eventTitle2, eventWhen2, palette, Math.round(render.height * 0.63));
    }
    if (eventTitle3) {
      drawEvent(eventTitle3, eventWhen3, palette, Math.round(render.height * 0.72));
    }
  } else {
    const status = eventState === "unavailable" ? "CALENDAR ACCESS NEEDED" :
      eventState === "empty" ? "NO EVENTS" : "SYNCING EVENTS";
    drawCentered(status, bodyFont, palette.foreground, Math.round(render.height * 0.56));
  }
  drawWeather(palette);
  render.end();
}

watch.addEventListener("minutechange", (event) => {
  if (event && event.date) lastDate = event.date;
  draw(lastDate);
});
