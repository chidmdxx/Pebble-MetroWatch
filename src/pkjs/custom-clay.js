module.exports = function () {
  var clay = this;
  clay.on(clay.EVENTS.AFTER_BUILD, function () {
    var accent = clay.getItemByMessageKey("ACCENT_COLOR");
    var preview = clay.getItemById("accent-preview");
    function updatePreview() {
      var value = accent.get();
      if (!/^#[0-9A-F]{6}$/.test(value)) {
        value = "#1EA1E0";
      }
      preview.set('<span style="display:inline-block;width:22px;height:22px;' +
        'vertical-align:middle;border:1px solid #888;background:' + value +
        ';margin-right:8px"></span>Accent preview ' + value);
    }
    accent.on("change", updatePreview);
    updatePreview();
  });
};
