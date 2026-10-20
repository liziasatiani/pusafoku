function push() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("URL");
  var token = props.getProperty("TOKEN");
  var label = Gmail.Users.Labels.get("me", "INBOX");
  var list = Gmail.Users.Messages.list("me", { labelIds: ["INBOX", "UNREAD"], maxResults: 8 });
  var items = (list.messages || []).map(function (m) {
    var g = Gmail.Users.Messages.get("me", m.id, { format: "metadata", metadataHeaders: ["From", "Subject"] });
    var header = function (name) {
      var found = g.payload.headers.filter(function (h) { return h.name.toLowerCase() === name; })[0];
      return found ? found.value : "";
    };
    return { id: m.id, from: header("from"), subject: header("subject"), at: Number(g.internalDate) };
  });
  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ unread: label.messagesUnread, items: items }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error("pusafoku answered " + res.getResponseCode());
}
