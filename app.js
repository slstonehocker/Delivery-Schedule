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

  document.getElementById("salespersonName").value =
    delivery ? delivery.salespersonName || "" : "";

  document.getElementById("salespersonEmail").value =
    delivery ? delivery.salespersonEmail || "" : "";

  document.getElementById("salespersonEmailConfirm").value =
    delivery ? delivery.salespersonEmail || "" : "";

  document.getElementById("orderNumber").value =
    delivery ? delivery.orderNumber || "" : "";

  document.getElementById("phoneNumber").value =
    delivery ? delivery.phoneNumber || "" : "";

  document.getElementById("onsiteContact").value =
    delivery ? delivery.onsiteContact || "" : "";

  document.getElementById("preferredTime").value =
    delivery ? delivery.preferredTime || "" : "";

  document.getElementById("address").value =
    delivery ? delivery.address || "" : "";

  document.getElementById("deliveryNotes").value =
    delivery ? delivery.deliveryNotes || "" : "";

  document.getElementById("popup").classList.remove("hidden");
  document.getElementById("saveSuccess").classList.add("hidden");

  // If viewing an existing delivery, make fields read-only
  const isExisting = !!delivery;
  const fields = ["salespersonName", "salespersonEmail", "salespersonEmailConfirm", "orderNumber", "phoneNumber", "onsiteContact", "preferredTime", "address", "deliveryNotes"];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (isExisting) {
      el.setAttribute("disabled", "true");
      el.style.background = "#f5f5f5";
      el.style.color = "#555";
      el.style.cursor = "not-allowed";
    } else {
      el.removeAttribute("disabled");
      el.style.background = "";
      el.style.color = "";
      el.style.cursor = "";
    }
  });

  // Show/hide Edit, Save and Delete buttons based on whether it's new or existing
  const editBtn   = document.getElementById("editBtn");
  const saveBtn   = document.getElementById("saveBtn");
  const deleteBtn = document.getElementById("deleteBtn");
  editBtn.style.display   = isExisting ? "" : "none";
  saveBtn.style.display   = isExisting ? "none" : "";
  deleteBtn.style.display = isExisting ? "none" : "";
}

function enableEdit() {
  const fields = ["salespersonName", "salespersonEmail", "salespersonEmailConfirm", "orderNumber", "phoneNumber", "onsiteContact", "preferredTime", "address", "deliveryNotes"];
  fields.forEach(id => {
    const el = document.getElementById(id);
    el.removeAttribute("disabled");
    el.style.background = "";
    el.style.color = "";
    el.style.cursor = "";
  });

  document.getElementById("editBtn").style.display   = "none";
  document.getElementById("saveBtn").style.display   = "";
  document.getElementById("deleteBtn").style.display = "";
}

function closePopup() {
  document.getElementById("popup").classList.add("hidden");
}

function saveDelivery() {
  const key = `${selectedDate}-slot-${selectedSlot}`;
  const isNewDelivery = !deliveries[key];

  // Prevent saving deliveries on days that have already passed
  const today = formatDate(new Date());
  if (isNewDelivery && selectedDate < today) {
    alert("This day has already passed. You cannot save a delivery for a past date.");
    return;
  }

  // Require all fields except address and delivery notes
  const requiredFields = ["salespersonName", "salespersonEmail", "salespersonEmailConfirm", "orderNumber", "phoneNumber", "onsiteContact", "preferredTime"];
  for (const id of requiredFields) {
    if (!document.getElementById(id).value.trim()) {
      alert("Please fill out all fields before saving (Address and Delivery Notes are optional).");
      return;
    }
  }

  // Validate salesperson email format
  const emailVal = document.getElementById("salespersonEmail").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
    alert("Please enter a valid email address.");
    return;
  }

  // Confirm email matches
  const emailConfirmVal = document.getElementById("salespersonEmailConfirm").value.trim();
  if (emailVal.toLowerCase() !== emailConfirmVal.toLowerCase()) {
    alert("Salesperson email and confirmation email do not match.");
    return;
  }

  // Validate phone number format: 10 digits (with optional separators)
  const phoneVal = document.getElementById("phoneNumber").value.trim();
  if (!/^\d{10}$/.test(phoneVal.replace(/[^0-9]/g, ""))) {
    alert("Please enter a valid 10-digit phone number.");
    return;
  }

  // Validate order number format: S + exactly 7 digits
  const orderVal = document.getElementById("orderNumber").value.trim();
  if (orderVal && !/^S\d{7}$/.test(orderVal)) {
    alert("Order number must start with S followed by exactly 7 digits (e.g. S1234567)");
    return;
  }

  // Prevent the same order number from being used in another slot
  for (const otherKey in deliveries) {
    if (otherKey === key) continue;
    if ((deliveries[otherKey].orderNumber || "").toUpperCase() === orderVal.toUpperCase()) {
      alert("This order number has already been scheduled for another delivery slot.");
      return;
    }
  }

  deliveries[key] = {
    salespersonName:  document.getElementById("salespersonName").value,
    salespersonEmail: document.getElementById("salespersonEmail").value,
    orderNumber:   document.getElementById("orderNumber").value,
    phoneNumber:   document.getElementById("phoneNumber").value,
    onsiteContact: document.getElementById("onsiteContact").value,
    preferredTime: document.getElementById("preferredTime").value,
    address:       document.getElementById("address").value,
    deliveryNotes: document.getElementById("deliveryNotes").value
  };

  localStorage.setItem("deliveries", JSON.stringify(deliveries));

  // Clear any leftover cancelled/approved status for this slot
  const cancelledSlots = JSON.parse(localStorage.getItem("cancelledSlots")) || {};
  const approvedSlots  = JSON.parse(localStorage.getItem("approvedSlots"))  || {};
  delete cancelledSlots[key];
  delete approvedSlots[key];
  localStorage.setItem("cancelledSlots", JSON.stringify(cancelledSlots));
  localStorage.setItem("approvedSlots",  JSON.stringify(approvedSlots));

  // Send approval email only when a NEW delivery is added
  if (isNewDelivery) {
    sendApprovalEmail(selectedDate, selectedSlot, deliveries[key]);
  } else {
    sendUpdateEmail(selectedDate, selectedSlot, deliveries[key]);
  }

  // Show success message then close after 2 seconds
  const successMsg = document.getElementById("saveSuccess");
  successMsg.classList.remove("hidden");
  setTimeout(() => {
    successMsg.classList.add("hidden");
    closePopup();
    renderCalendar();
  }, 2000);
}

async function sendApprovalEmail(dateKey, slot, delivery) {
  try {
    const adminLink = `${window.location.origin}${window.location.pathname.replace("index.html", "")}admin.html?date=${dateKey}`;
    await emailjs.send(
      "service_7alcqe6",
      "template_q7tskkd",
      {
        dateKey:          dateKey,
        slot:             slot,
        orderNumber:      delivery.orderNumber      || "—",
        onsiteContact:    delivery.onsiteContact    || "—",
        phoneNumber:      delivery.phoneNumber      || "—",
        preferredTime:    delivery.preferredTime    || "—",
        address:          delivery.address          || "—",
        deliveryNotes:    delivery.deliveryNotes    || "—",
        salespersonName:  delivery.salespersonName  || "—",
        salespersonEmail: delivery.salespersonEmail || "—",
        adminLink:        adminLink
      }
    );
    console.log("Approval email sent for Order #" + delivery.orderNumber);
  } catch (err) {
    console.warn("Email failed to send:", err);
  }
}

async function sendUpdateEmail(dateKey, slot, delivery) {
  try {
    const adminLink = `${window.location.origin}${window.location.pathname.replace("index.html", "")}admin.html?date=${dateKey}`;
    await emailjs.send(
      "service_7alcqe6",
      "template_update123",
      {
        dateKey:          dateKey,
        slot:             slot,
        orderNumber:      delivery.orderNumber      || "—",
        onsiteContact:    delivery.onsiteContact    || "—",
        phoneNumber:      delivery.phoneNumber      || "—",
        preferredTime:    delivery.preferredTime    || "—",
        address:          delivery.address          || "—",
        deliveryNotes:    delivery.deliveryNotes    || "—",
        salespersonName:  delivery.salespersonName  || "—",
        salespersonEmail: delivery.salespersonEmail || "—",
        adminLink:        adminLink
      }
    );
    console.log("Update email sent for Order #" + delivery.orderNumber);
  } catch (err) {
    console.warn("Update email failed to send:", err);
  }
}

function deleteDelivery() {
  const key = `${selectedDate}-slot-${selectedSlot}`;

  const confirmed = confirm("Are you sure you want to delete this delivery?");

  if (!confirmed) {
    return;
  }

  const delivery = deliveries[key];

  delete deliveries[key];

  localStorage.setItem("deliveries", JSON.stringify(deliveries));

  if (delivery) {
    const removedDeliveries = JSON.parse(localStorage.getItem("removedDeliveries")) || {};
    removedDeliveries[key] = { delivery, reason: "Removed" };
    localStorage.setItem("removedDeliveries", JSON.stringify(removedDeliveries));
  }

  // Send deletion email to salesperson
  if (delivery && delivery.salespersonEmail) {
    const dateKey = key.split("-slot-")[0];
    const slot    = key.split("-slot-")[1];
    const [y, m, d] = dateKey.split("-").map(Number);
    const displayDate = new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    });

    emailjs.send(
      "service_7alcqe6",
      "template_b71mbas",
      {
        salespersonName:  delivery.salespersonName  || "Salesperson",
        salespersonEmail: delivery.salespersonEmail,
        message:          "Your delivery request has been deleted. Please contact your manager for more information.",
        orderNumber:      delivery.orderNumber      || "—",
        dateKey:          displayDate,
        slot:             slot,
        onsiteContact:    delivery.onsiteContact    || "—",
        phoneNumber:      delivery.phoneNumber      || "—",
        preferredTime:    delivery.preferredTime    || "—",
        address:          delivery.address          || "—",
        deliveryNotes:    delivery.deliveryNotes    || "—"
      }
    ).catch(err => console.warn("Failed to send deletion email:", err));
  }

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

    if (!delivery) continue;

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

function showMyDeliveries() {
  const name = document.getElementById("myDeliveriesName").value.trim().toLowerCase();
  const resultsBox = document.getElementById("myDeliveriesResults");

  if (!name) {
    resultsBox.classList.add("hidden");
    return;
  }

  const matches = Object.keys(deliveries)
    .filter(key => (deliveries[key].salespersonName || "").toLowerCase().includes(name))
    .sort();

  if (!matches.length) {
    resultsBox.innerHTML = `<h3>My Deliveries</h3><div>No deliveries found for this name.</div>`;
    resultsBox.classList.remove("hidden");
    return;
  }

  resultsBox.innerHTML = `<h3>My Deliveries</h3>` + matches.map(key => {
    const delivery = deliveries[key];
    const dateKey = key.split("-slot-")[0];
    const slot    = key.split("-slot-")[1];
    const displayDate = formatDisplayDate(new Date(dateKey + "T12:00:00"));
    return `
      <div class="my-delivery-item" onclick="goToDelivery('${dateKey}', ${slot})">
        <span>${displayDate} — Slot ${slot} — Order #${delivery.orderNumber || "—"}</span>
        <span>${delivery.preferredTime || ""}</span>
      </div>
    `;
  }).join("");

  resultsBox.classList.remove("hidden");
}

function goToDelivery(dateKey, slot) {
  const deliveryDate = new Date(dateKey + "T12:00:00");
  currentMonday = getMonday(deliveryDate);
  renderCalendar();

  setTimeout(() => {
    openPopup(dateKey, slot);
  }, 50);
}

// Auto-prefix order number with S and allow only digits after
document.getElementById("orderNumber").addEventListener("input", function () {
  if (this.disabled) return;
  let val = this.value.toUpperCase();

  // Always ensure it starts with S
  if (!val.startsWith("S")) {
    val = "S" + val.replace(/[^0-9]/g, "");
  } else {
    // Keep S and only digits after it
    val = "S" + val.slice(1).replace(/[^0-9]/g, "");
  }

  // Max 8 characters (S + 7 digits)
  if (val.length > 8) {
    val = val.slice(0, 8);
    alert("Order number exceeds the limit: must be S followed by exactly 7 digits (e.g. S1234567)");
  }

  this.value = val;
});

renderCalendar();

// Auto-refresh every 5 seconds, but only when popup is closed
setInterval(() => {
  if (document.getElementById("popup").classList.contains("hidden")) {
    renderCalendar();
  }
}, 5000);

// Instantly refresh if data changes in another tab
window.addEventListener("storage", () => {
  if (document.getElementById("popup").classList.contains("hidden")) {
    renderCalendar();
  }
});