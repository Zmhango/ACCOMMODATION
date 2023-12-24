
window.addEventListener("scroll", function () {
  const scrollTop =
    document.documentElement.scrollTop || document.body.scrollTop;
  const scrollHeight =
    document.documentElement.scrollHeight -
    document.documentElement.clientHeight;
  const scrolled = (scrollTop / scrollHeight) * 100;
  document.querySelector(".progress-bar").style.width = scrolled + "%";


});

// Registration script




// Login Script

