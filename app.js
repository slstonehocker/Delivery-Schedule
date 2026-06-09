let currentMonday = getMonday(new Date());
let selectedDate = "";
let selectedSlot = "";

let deliveries     = JSON.parse(localStorage.getItem("deliveries"))      || {};
let blockedDays    = JSON.parse(localStorage.getItem("blockedDays"))     || {};
let cancelledSlots = JSON.parse(localStorage.getItem("cancelledSlots"))  || {};

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function renderCalendar() {
  deliveries     = JSON.parse(localStorage.getItem("deliveries"))      || {};
  blockedDays    = JSON.parse(localStorage.getItem("blockedDays"))     || {};
  cancelledSlots = JSON.parse(localStorage.getItem("cancelledSlots"))  || {};
  const approvedSlots = JSON.parse(localStorage.getItem("approvedSlots")) || {};

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

    const isBlocked = !!blockedDays[dateKey];

    if (isBlocked) {
      const blockInfo = blockedDays[dateKey];
      dayBox.style.opacity = "0.7";
      dayBox.style.border = "2px solid #991b1b";
      dayBox.innerHTML = `
        <div class="day-header" style="background:#991b1b;">
          ${dayName}<br>${formatDisplayDate(date)}
        </div>
        <div style="background:#fee2e2;color:#991b1b;text-align:center;padding:12px;border-radius:6px;font-weight:bold;margin-bottom:6px;">
          ⛔ Day Blocked<br>
          <span style="font-size:12px;font-weight:normal;">${blockInfo.reason}${blockInfo.note ? " — "+blockInfo.note : ""}</span>
        </div>
      `;
    } else {
      dayBox.innerHTML = `
        <div class="day-header">
          ${dayName}<br>
          ${formatDisplayDate(date)}
        </div>
      `;
    }

    for (let slot = 1; slot <= 5; slot++) {
      const key = `${dateKey}-slot-${slot}`;
      const delivery = deliveries[key];

      const slotBox = document.createElement("div");
      slotBox.className = "slot";

      if (delivery) {
        const isCancelled = !!cancelledSlots[key] || isBlocked;
        const isApproved  = !!approvedSlots[key];
        slotBox.classList.add("filled");
        if (isCancelled) slotBox.style.borderLeft = "5px solid #991b1b";
        if (isApproved)  slotBox.style.borderLeft = "5px solid #166534";

        slotBox.innerHTML = `
          <div class="slot-number">Slot ${slot}</div>
          <div class="status ${isCancelled ? "" : isApproved ? "" : "pending"}" style="${
            isCancelled ? "background:#fee2e2;color:#991b1b;" :
            isApproved  ? "background:#dcfce7;color:#166534;" : ""
          }">
            ${isCancelled ? "🚫 Cancelled" : isApproved ? "✅ Approved" : "Pending Approval"}
          </div>
          <div class="delivery-line"><strong>Order #:</strong> ${delivery.orderNumber || ""}</div>
          <div class="delivery-line"><strong>Phone:</strong> ${delivery.phoneNumber || ""}</div>
          <div class="delivery-line"><strong>Contact:</strong> ${delivery.onsiteContact || ""}</div>
          <div class="delivery-line"><strong>Time:</strong> ${delivery.preferredTime || ""}</div>
          <div class="delivery-line"><strong>Address:</strong> ${delivery.address || ""}</div>
          <div class="delivery-line">
            <strong>Notes:</strong>
            ${(delivery.deliveryNotes || "").substring(0, 30)}
            ${(delivery.deliveryNotes || "").length > 30 ? "..." : ""}
          </div>
        `;
      } else {
        slotBox.innerHTML = `
          <div class="slot-number">Slot ${slot}</div>
          <div class="open">Click to add delivery</div>
        `;
      }

      if (!isBlocked) {
        slotBox.setAttribute("onclick", `openPopup('${dateKey}', ${slot})`);
      } else {
        slotBox.style.cursor = "not-allowed";
        slotBox.style.opacity = "0.6";
      }
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

  document.getElementById("deliveryNotes").value =
    delivery ? delivery.deliveryNotes || "" : "";

  document.getElementById("popup").classList.remove("hidden");
}

function closePopup() {
  document.getElementById("popup").classList.add("hidden");
}

function saveDelivery() {
  const key = `${selectedDate}-slot-${selectedSlot}`;
  const isNewDelivery = !deliveries[key];

  deliveries[key] = {
    orderNumber:   document.getElementById("orderNumber").value,
    phoneNumber:   document.getElementById("phoneNumber").value,
    onsiteContact: document.getElementById("onsiteContact").value,
    preferredTime: document.getElementById("preferredTime").value,
    address:       document.getElementById("address").value,
    deliveryNotes: document.getElementById("deliveryNotes").value
  };

  localStorage.setItem("deliveries", JSON.stringify(deliveries));

  // Send approval email only when a NEW delivery is added
  if (isNewDelivery) {
    sendApprovalEmail(selectedDate, selectedSlot, deliveries[key]);
  }

  closePopup();
  renderCalendar();
}

async function sendApprovalEmail(dateKey, slot, delivery) {
  try {
    const adminLink = `${window.location.origin}${window.location.pathname.replace("index.html", "")}admin.html?date=${dateKey}`;
    await emailjs.send(
      "service_7alcqe6",
      "template_q7tskkd",
      {
        dateKey:       dateKey,
        slot:          slot,
        orderNumber:   delivery.orderNumber   || "—",
        onsiteContact: delivery.onsiteContact || "—",
        phoneNumber:   delivery.phoneNumber   || "—",
        preferredTime: delivery.preferredTime || "—",
        address:       delivery.address       || "—",
        deliveryNotes: delivery.deliveryNotes || "—",
        adminLink:     adminLink
      }
    );
    console.log("Approval email sent for Order #" + delivery.orderNumber);
  } catch (err) {
    console.warn("Email failed to send:", err);
  }
}

function deleteDelivery() {
  const key = `${selectedDate}-slot-${selectedSlot}`;

  const confirmed = confirm("Are you sure you want to delete this delivery?");

  if (!confirmed) {
    return;
  }

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

function searchOrder() {
  const searchValue = document
    .getElementById("searchOrder")
    .value
    .trim()
    .toLowerCase();

  if (!searchValue) {
    return;
  }

  for (const key in deliveries) {
    const delivery = deliveries[key];

    if (
      delivery.orderNumber &&
      delivery.orderNumber.toLowerCase().includes(searchValue)
    ) {
      const dateKey = key.split("-slot-")[0];
      const slot    = key.split("-slot-")[1];

      // Navigate to the week containing this delivery
      const deliveryDate = new Date(dateKey + "T12:00:00");
      currentMonday = getMonday(deliveryDate);
      renderCalendar();

      // Highlight the slot after rendering
      setTimeout(() => {
        // Find all slot elements and match by onclick attribute
        const allSlots = document.querySelectorAll(".slot");
        let targetSlot = null;
        allSlots.forEach(s => {
          const attr = s.getAttribute("onclick") || "";
          if (attr.includes(`'${dateKey}'`) && attr.includes(`, ${slot})`)) {
            targetSlot = s;
          }
        });

        if (targetSlot) {
          // Scroll the slot into view
          targetSlot.scrollIntoView({ behavior: "smooth", block: "center" });

          // Flash highlight animation
          targetSlot.style.transition = "box-shadow 0.2s, transform 0.2s";
          targetSlot.style.boxShadow  = "0 0 0 3px #811419, 0 4px 16px rgba(129,20,25,0.35)";
          targetSlot.style.transform  = "scale(1.03)";

          setTimeout(() => {
            targetSlot.style.boxShadow = "";
            targetSlot.style.transform = "";
          }, 1500);
        }

        // Open the popup
        openPopup(dateKey, slot);
      }, 50);

      return;
    }
  }

  alert("Order not found.");
}

function goToToday() {
  currentMonday = getMonday(new Date());
  renderCalendar();
}

function clearSearch() {
  document.getElementById("searchOrder").value = "";
}

renderCalendar();