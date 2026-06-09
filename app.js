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
          <div class="status pending">${delivery.status || "Pending Approval"}</div>
          <div class="delivery-line"><strong>Order #:</strong> ${delivery.orderNumber || ""}</div>
          <div class="delivery-line"><strong>Phone:</strong> ${delivery.phoneNumber || ""}</div>
          <div class="delivery-line"><strong>Contact:</strong> ${delivery.onsiteContact || ""}</div>
          <div class="delivery-line"><strong>Time:</strong> ${delivery.preferredTime || ""}</div>
          <div class="delivery-line"><strong>Address:</strong> ${delivery.address || ""}</div>
        `;
      } else {
        slotBox.innerHTML = `
          <div class="slot-number">Slot ${slot}</div>
          <div class="open">Click to add delivery</div>
        `;
      }

      slotBox.setAttribute("onclick", `openPopup('${dateKey}', ${slot})`);
      dayBox.appendChild(slotBox);
    }

    calendar.appendChild(dayBox);
  });
}

function openPopup(dateKey, slot) {
  selectedDate = dateKey;
  selectedSlot = slot;

  const key = `${selectedDate}-slot-${selectedSlot}`;
  const delivery = deliveries[key];

  document.getElementById("popupTitle").textContent =
    `Delivery for ${selectedDate} - Slot ${selectedSlot}`;

  document.getElementById("orderNumber").value =
    delivery ? delivery.orderNumber || "" : "";

  document.getElementById("phoneNumber").value =
    delivery ? delivery.phoneNumber || "" : "";

  document.getElementById("onsiteContact").value =
    delivery ? delivery.onsiteContact || "" : "";

  document.getElementById("preferredTime").value =
    delivery ? delivery.preferredTime || "Early Morning" : "Early Morning";

  document.getElementById("address").value =
    delivery ? delivery.address || "" : "";

  document.getElementById("popup").classList.remove("hidden");
}

function closePopup() {
  document.getElementById("popup").classList.add("hidden");
}

function saveDelivery() {
  const key = `${selectedDate}-slot-${selectedSlot}`;

  deliveries[key] = {
    orderNumber: document.getElementById("orderNumber").value,
    phoneNumber: document.getElementById("phoneNumber").value,
    onsiteContact: document.getElementById("onsiteContact").value,
    preferredTime: document.getElementById("preferredTime").value,
    address: document.getElementById("address").value,
    status: "Pending Approval"
  };

  localStorage.setItem("deliveries", JSON.stringify(deliveries));

  closePopup();
  renderCalendar();
}

function deleteDelivery() {
  const key = `${selectedDate}-slot-${selectedSlot}`;

  delete deliveries[key];

  localStorage.setItem("deliveries", JSON.stringify(deliveries));

  closePopup();
  renderCalendar();
}

function changeWeek(direction) {
  currentMonday.setDate(currentMonday.getDate() + direction * 7);
  renderCalendar();
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

renderCalendar();

//sales order number, onsuite contact, preffered time, address(optional), approval email after manager approves
