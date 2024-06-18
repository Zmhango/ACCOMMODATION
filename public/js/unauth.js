// Optional: JavaScript for additional interactivity
const authMessage = document.querySelector(".auth-message");

authMessage.addEventListener("mouseenter", function () {
  this.style.backgroundColor = "#f0f8ff"; // Light Blue
});

authMessage.addEventListener("mouseleave", function () {
  this.style.backgroundColor = "#fff"; // White
});
