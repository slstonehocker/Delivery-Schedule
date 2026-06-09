let currentMonday = getMonday(new Date());
let selectedDate = "";
let selectedSlot = "";

let deliveries = JSON.parse(localStorage.getItem("deliveries")) || {};

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function renderCalendar() {
  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  const friday = new Date(currentMonday);
  friday.setDate(currentMonday.getDate() + 4);

  document.getElementById("weekTitle").textContent =
    formatDisplayDate(currentMonday) + " - " + formatDisplayDate(friday);

  days.forEach((dayName, index) => {
    const date = new Date(currentMonday);
    date.setDate(currentMonday.getDate() + index);

    const dateKey = formatDate(date);

    const dayBox = document.createElement("div");
    dayBox.className = "day";

    dayBox.innerHTML = `
      <div class="day-header">
        ${dayName}<br>
        ${formatDisplayDate(date)}
      </div>
    `;

    for (let slot = 1; slot <= 5; slot++) {
      const key = `${dateKey}-slot-${slot}`;
      const delivery = deliveries[key];

      const slotBox = document.createElement("div");
      slotBox.className = "slot";

      if (delivery) {
        slotBox.classList.add("filled");
        slotBox.innerHTML = `
          <div class="slot-number">Slot ${slot}</div>
          <div class="customer">${delivery.customer}</div>
          <div class="small">${delivery.address}</div>
          <div class="small">${delivery.materials}</div>
        `;
      } else {
        slotBox.innerHTML = `
          <div class="slot-number">Slot ${slot}</div>
          <div class="open">Click to add delivery</div>
        `;
      }

   slotBox.setAttribute(
    "onclick",
    `openPopup('${dateKey}', ${slot})`
);

      dayBox.appendChild(slotBox);
    }

    calendar.appendChild(dayBox);
  });
}

renderCalendar();