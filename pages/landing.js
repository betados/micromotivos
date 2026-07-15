(function () {
  var items = document.querySelectorAll("#featured .featured-item");
  if (items.length < 2) return;

  var pick = Math.floor(Math.random() * items.length);
  for (var i = 0; i < items.length; i++) {
    // Inline style beats the stylesheet's "show the first one only" fallback.
    items[i].style.display = i === pick ? "block" : "none";
  }
})();
