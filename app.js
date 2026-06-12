// ── API Configuration ──────────────────────────────────────────────────────
const API_URL = "http://localhost:4000";

// ── Helpers (defined first so everything can use them) ─────────────────────
function getMonday(date) {
  const d    = new Date(date);
  const day  = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── State ──────────────────────────────────────────────────────────────────
let currentMonday = getMonday(new Date());
let selectedDate  = "";
let selectedSlot  = "";
let deliveries    = {};
let blockedDays   = {};
let blockedTimes  = {};  // { "2026-06-10": ["Early Morning", "Late Morning"] }
let isLoading     = false;

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// ── Fetch data from API ────────────────────────────────────────────────────
async function loadData() {
  try {
    const weekStart = formatDate(currentMonday);

    // Load deliveries and blocked days in parallel
    const [deliveriesRes, blockedRes, blockedTimesRes] = await Promise.all([
      fetch(`${API_URL}/deliveries?weekStart=${weekStart}`),
      fetch(`${API_URL}/blocked-days`),
      fetch(`${API_URL}/blocked-times`)
    ]);

    const deliveriesArr  = await deliveriesRes.json();
    const blockedArr     = await blockedRes.json();
    const blockedTimesArr = await blockedTimesRes.json();

    // Convert deliveries array to a keyed object the calendar can use
    deliveries = {};
    deliveriesArr.forEach(d => {
      const key = `${d.date_key}-slot-${d.slot}`;
      deliveries[key] = {
        id:               d.id,
        orderNumber:      d.order_number,
        phoneNumber:      d.phone_number,
        onsiteContact:    d.onsite_contact,
        preferredTime:    d.preferred_time,
        address:          d.address,
        deliveryNotes:    d.delivery_notes,
        salespersonName:  d.salesperson_name,
        salespersonEmail: d.salesperson_email,
        status:           d.status
      };
    });

    // Convert blocked days array to keyed object
    blockedDays = {};
    blockedArr.forEach(b => {
      blockedDays[b.date_key] = { reason: b.reason, note: b.note };
    });

    // Convert blocked times array to keyed object
    blockedTimes = {};
    blockedTimesArr.forEach(t => {
      if (!blockedTimes[t.date_key]) blockedTimes[t.date_key] = [];
      blockedTimes[t.date_key].push(t.preferred_time);
    });

  } catch (err) {
    console.error("Failed to load data from API:", err);
  }
}

// ── Render Calendar ────────────────────────────────────────────────────────
async function renderCalendar() {
  if (isLoading) return;
  isLoading = true;
  await loadData();
  isLoading = false;

  const calendar = document.getElementById("calendar");
  calendar.innerHTML = "";

  const friday = new Date(currentMonday);
  friday.setDate(currentMonday.getDate() + 4);

  document.getElementById("weekTitle").textContent =
    formatDisplayDate(currentMonday) + " - " + formatDisplayDate(friday);

  days.forEach((dayName, index) => {
    const date    = new Date(currentMonday);
    date.setDate(currentMonday.getDate() + index);
    const dateKey = formatDate(date);

    const dayBox = document.createElement("div");
    dayBox.className = "day";

    const today  = formatDate(new Date());
    const isPast = dateKey < today;

    if (dateKey === today) dayBox.classList.add("today");
    if (isPast) dayBox.classList.add("past");

    const isBlocked = !!blockedDays[dateKey];

    if (isBlocked) {
      const blockInfo = blockedDays[dateKey];
      dayBox.style.opacity = "0.7";
      dayBox.style.border  = "2px solid #991b1b";
      dayBox.innerHTML = `
        <div class="day-header" style="background:#991b1b;">
          ${dayName}<br>${formatDisplayDate(date)}
        </div>
        <div style="background:#fee2e2;color:#991b1b;text-align:center;padding:12px;border-radius:6px;font-weight:bold;margin-bottom:6px;">
          Day Blocked<br>
          <span style="font-size:12px;font-weight:normal;">${blockInfo.reason}${blockInfo.note ? " — "+blockInfo.note : ""}</span>
        </div>
      `;
    } else {
      const filledCount = [1,2,3,4,5,6].filter(s => !!deliveries[`${dateKey}-slot-${s}`]).length;
      const isFull      = filledCount >= 6;
      const isDisabled  = isFull || isPast;

      dayBox.innerHTML = `
        <div class="add-delivery-bar">
          <button
            class="add-delivery-btn${isDisabled ? " full" : ""}"
            ${isDisabled ? "disabled" : `onclick="addDelivery('${dateKey}')"`}
          >${isFull ? "Day Full" : isPast ? "Past" : "Add Delivery"}</button>
          <span class="slot-count">${filledCount} / 6</span>
        </div>
        <div class="day-header">
          ${dayName}<br>${formatDisplayDate(date)}
        </div>
      `;

      if (filledCount === 0 && (!blockedTimes[dateKey] || blockedTimes[dateKey].length === 0)) {
        dayBox.innerHTML += `<div class="empty-day">No deliveries scheduled yet.</div>`;
      }

      // Show blocked time notices
      if (blockedTimes[dateKey] && blockedTimes[dateKey].length > 0) {
        blockedTimes[dateKey].forEach(time => {
          dayBox.innerHTML += `
            <div class="blocked-time-notice">
              ${time} — Blocked
            </div>
          `;
        });
      }
    }

    const timeOrder = { "Early Morning": 1, "Late Morning": 2, "Early Afternoon": 3, "Late Afternoon": 4, "": 5 };
    const slotEntries = [];
    for (let slot = 1; slot <= 6; slot++) {
      const key = `${dateKey}-slot-${slot}`;
      slotEntries.push({ slot, key, delivery: deliveries[key] });
    }
    slotEntries.sort((a, b) => {
      const aTime = a.delivery ? (timeOrder[a.delivery.preferredTime] || 5) : 6;
      const bTime = b.delivery ? (timeOrder[b.delivery.preferredTime] || 5) : 6;
      return aTime - bTime;
    });

    slotEntries.forEach(({ slot, key, delivery }) => {
      if (!delivery) return; // only show filled slots

      const slotBox = document.createElement("div");
      slotBox.className = "slot";

      const isCancelled = delivery.status === "cancelled";
      const isApproved  = delivery.status === "approved";
      slotBox.classList.add("filled");
      if (isCancelled) slotBox.style.borderLeft = "5px solid #991b1b";
      if (isApproved)  slotBox.style.borderLeft = "5px solid #166534";

      slotBox.innerHTML = `
        <div class="slot-number">Slot ${slot}</div>
        <div class="status ${isCancelled ? "" : isApproved ? "" : "pending"}" style="${
          isCancelled ? "background:#fee2e2;color:#991b1b;" :
          isApproved  ? "background:#dcfce7;color:#166534;" : ""
        }">
          ${isCancelled ? "Cancelled" : isApproved ? "Approved" : "Pending Approval"}
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

      if (!isPast) {
        slotBox.setAttribute("onclick", `openPopup('${dateKey}', ${slot})`);
      } else {
        slotBox.style.cursor = "default";
      }
      dayBox.appendChild(slotBox);
    });

    calendar.appendChild(dayBox);
  });
}

// ── Add Delivery (finds next open slot) ───────────────────────────────────
function addDelivery(dateKey) {
  // Find the first empty slot
  for (let slot = 1; slot <= 6; slot++) {
    const key = `${dateKey}-slot-${slot}`;
    if (!deliveries[key]) {
      openPopup(dateKey, slot);
      return;
    }
  }
  // All slots full (shouldn't reach here since button is disabled when full)
  alert("This day is full — no slots available.");
}

// ── Open Popup ─────────────────────────────────────────────────────────────
function openPopup(dateKey, slot) {
  selectedDate = dateKey;
  selectedSlot = slot;

  const key      = `${selectedDate}-slot-${selectedSlot}`;
  const delivery = deliveries[key];

  document.getElementById("popupTitle").textContent =
    `Delivery for ${selectedDate} - Slot ${selectedSlot}`;

  document.getElementById("salespersonName").value        = delivery ? delivery.salespersonName  || "" : "";
  document.getElementById("salespersonEmail").value       = delivery ? delivery.salespersonEmail || "" : "";
  document.getElementById("salespersonEmailConfirm").value= delivery ? delivery.salespersonEmail || "" : "";
  document.getElementById("orderNumber").value            = delivery ? delivery.orderNumber      || "" : "S";
  document.getElementById("phoneNumber").value            = delivery ? delivery.phoneNumber      || "" : "";
  document.getElementById("onsiteContact").value          = delivery ? delivery.onsiteContact    || "" : "";
  document.getElementById("preferredTime").value          = delivery ? delivery.preferredTime    || "" : "";
  document.getElementById("address").value                = delivery ? delivery.address          || "" : "";
  document.getElementById("deliveryNotes").value          = delivery ? delivery.deliveryNotes    || "" : "";

  document.getElementById("popup").classList.remove("hidden");
  document.getElementById("saveSuccess").classList.add("hidden");

  // Grey out preferred time options that are already at the limit (2 per time per day)
  const TIME_LIMIT = 2;
  const timeCounts = {};
  for (let s = 1; s <= 6; s++) {
    const k = `${dateKey}-slot-${s}`;
    if (deliveries[k] && deliveries[k].preferredTime && k !== key) {
      const t = deliveries[k].preferredTime;
      timeCounts[t] = (timeCounts[t] || 0) + 1;
    }
  }
  const select = document.getElementById("preferredTime");
  Array.from(select.options).forEach(opt => {
    if (!opt.value) return;
    const isTimeFull    = (timeCounts[opt.value] || 0) >= TIME_LIMIT;
    const isTimeBlocked = blockedTimes[dateKey] && blockedTimes[dateKey].includes(opt.value);
    if (isTimeFull) {
      opt.disabled = true;
      opt.text = opt.value + " (full)";
      opt.style.color = "#aaa";
    } else if (isTimeBlocked) {
      opt.disabled = true;
      opt.text = opt.value + " (blocked)";
      opt.style.color = "#aaa";
    } else {
      opt.disabled = false;
      opt.text = opt.value;
      opt.style.color = "";
    }
  });

  const isExisting = !!delivery;
  const fields = ["salespersonName","salespersonEmail","salespersonEmailConfirm","orderNumber","phoneNumber","onsiteContact","preferredTime","address","deliveryNotes"];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (isExisting) {
      el.setAttribute("disabled", "true");
      el.style.background = "#f5f5f5";
      el.style.color      = "#555";
      el.style.cursor     = "not-allowed";
    } else {
      el.removeAttribute("disabled");
      el.style.background = "";
      el.style.color      = "";
      el.style.cursor     = "";
    }
  });

  const editBtn   = document.getElementById("editBtn");
  const saveBtn   = document.getElementById("saveBtn");
  const deleteBtn = document.getElementById("deleteBtn");
  editBtn.style.display   = isExisting ? "" : "none";
  saveBtn.style.display   = isExisting ? "none" : "";
  deleteBtn.style.display = isExisting ? "none" : "";
}

function enableEdit() {
  const fields = ["salespersonName","salespersonEmail","salespersonEmailConfirm","orderNumber","phoneNumber","onsiteContact","preferredTime","address","deliveryNotes"];
  fields.forEach(id => {
    const el = document.getElementById(id);
    el.removeAttribute("disabled");
    el.style.background = "";
    el.style.color      = "";
    el.style.cursor     = "";
  });
  document.getElementById("editBtn").style.display   = "none";
  document.getElementById("saveBtn").style.display   = "";
  document.getElementById("deleteBtn").style.display = "";
}

function closePopup() {
  document.getElementById("popup").classList.add("hidden");
}

// ── Save Delivery ──────────────────────────────────────────────────────────
async function saveDelivery() {
  const key          = `${selectedDate}-slot-${selectedSlot}`;
  const isNewDelivery = !deliveries[key];

  // Prevent saving on past dates
  const today = formatDate(new Date());
  if (isNewDelivery && selectedDate < today) {
    alert("This day has already passed. You cannot save a delivery for a past date.");
    return;
  }

  // Validate required fields
  const requiredFields = ["salespersonName","salespersonEmail","salespersonEmailConfirm","orderNumber","phoneNumber","onsiteContact","preferredTime"];
  for (const id of requiredFields) {
    if (!document.getElementById(id).value.trim()) {
      alert("Please fill out all required fields (Address and Delivery Notes are optional).");
      return;
    }
  }

  // Validate email format
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

  // Validate phone number
  const phoneVal = document.getElementById("phoneNumber").value.trim();
  if (!/^\d{10}$/.test(phoneVal.replace(/[^0-9]/g, ""))) {
    alert("Please enter a valid 10-digit phone number.");
    return;
  }

  // Validate order number
  const orderVal = document.getElementById("orderNumber").value.trim();
  if (orderVal && !/^S\d{7}$/.test(orderVal)) {
    alert("Order number must start with S followed by exactly 7 digits (e.g. S1234567)");
    return;
  }

  // Check for duplicate order number
  for (const otherKey in deliveries) {
    if (otherKey === key) continue;
    if ((deliveries[otherKey].orderNumber || "").toUpperCase() === orderVal.toUpperCase()) {
      alert("This order number has already been scheduled for another delivery slot.");
      return;
    }
  }

  const deliveryData = {
    dateKey:          selectedDate,
    slot:             selectedSlot,
    salespersonName:  document.getElementById("salespersonName").value,
    salespersonEmail: document.getElementById("salespersonEmail").value,
    orderNumber:      document.getElementById("orderNumber").value,
    phoneNumber:      document.getElementById("phoneNumber").value,
    onsiteContact:    document.getElementById("onsiteContact").value,
    preferredTime:    document.getElementById("preferredTime").value,
    address:          document.getElementById("address").value,
    deliveryNotes:    document.getElementById("deliveryNotes").value
  };

  try {
    const res = await fetch(`${API_URL}/deliveries`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(deliveryData)
    });

    const data = await res.json();

    if (!res.ok) {
      alert("Error saving delivery: " + (data.error || "Unknown error"));
      return;
    }

    // Send approval email
    sendApprovalEmail(selectedDate, selectedSlot, deliveryData);

    // Show success message then close
    const successMsg = document.getElementById("saveSuccess");
    successMsg.classList.remove("hidden");
    setTimeout(() => {
      successMsg.classList.add("hidden");
      closePopup();
      renderCalendar();
    }, 2000);

  } catch (err) {
    console.error("Failed to save delivery:", err);
    alert("Could not connect to the server. Make sure the backend is running.");
  }
}

// ── Delete Delivery ────────────────────────────────────────────────────────
async function deleteDelivery() {
  const key      = `${selectedDate}-slot-${selectedSlot}`;
  const delivery = deliveries[key];

  if (!confirm("Are you sure you want to delete this delivery?")) return;

  try {
    await fetch(`${API_URL}/deliveries/${delivery.id}`, { method: "DELETE",
      headers: { "Authorization": "Bearer " + (sessionStorage.getItem("adminToken") || "") }
    });

    // Send deletion email to salesperson
    if (delivery && delivery.salespersonEmail) {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const displayDate = new Date(y, m-1, d).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric"
      });
      emailjs.send("service_7alcqe6", "template_b71mbas", {
        salespersonName:  delivery.salespersonName  || "Salesperson",
        salespersonEmail: delivery.salespersonEmail,
        message:          "Your delivery request has been deleted.",
        orderNumber:      delivery.orderNumber || "—",
        dateKey:          displayDate,
        slot:             selectedSlot,
        onsiteContact:    delivery.onsiteContact  || "—",
        phoneNumber:      delivery.phoneNumber    || "—",
        preferredTime:    delivery.preferredTime  || "—",
        address:          delivery.address        || "—",
        deliveryNotes:    delivery.deliveryNotes  || "—"
      }).catch(err => console.warn("Deletion email failed:", err));
    }

    closePopup();
    renderCalendar();

  } catch (err) {
    console.error("Failed to delete delivery:", err);
    alert("Could not delete delivery. Make sure the backend is running.");
  }
}

// ── Email Functions ────────────────────────────────────────────────────────
async function sendApprovalEmail(dateKey, slot, delivery) {
  try {
    const adminLink = `${window.location.origin}${window.location.pathname.replace("index.html", "")}admin.html?date=${dateKey}`;
    await emailjs.send("service_7alcqe6", "template_q7tskkd", {
      dateKey, slot,
      orderNumber:      delivery.orderNumber      || "—",
      onsiteContact:    delivery.onsiteContact    || "—",
      phoneNumber:      delivery.phoneNumber      || "—",
      preferredTime:    delivery.preferredTime    || "—",
      address:          delivery.address          || "—",
      deliveryNotes:    delivery.deliveryNotes    || "—",
      salespersonName:  delivery.salespersonName  || "—",
      salespersonEmail: delivery.salespersonEmail || "—",
      adminLink
    });
    console.log("Approval email sent for Order #" + delivery.orderNumber);
  } catch (err) {
    console.warn("Email failed to send:", err);
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────
function changeWeek(direction) {
  currentMonday.setDate(currentMonday.getDate() + direction * 7);
  renderCalendar();
}

function goToToday() {
  currentMonday = getMonday(new Date());
  renderCalendar();
}

// ── Search ─────────────────────────────────────────────────────────────────
function searchOrder() {
  const searchValue = document.getElementById("searchOrder").value.trim().toLowerCase();
  if (!searchValue) return;

  for (const key in deliveries) {
    const delivery = deliveries[key];
    if (!delivery) continue;
    if (delivery.orderNumber && delivery.orderNumber.toLowerCase().includes(searchValue)) {
      const dateKey = key.split("-slot-")[0];
      const slot    = key.split("-slot-")[1];
      const deliveryDate = new Date(dateKey + "T12:00:00");
      currentMonday = getMonday(deliveryDate);
      renderCalendar().then(() => {
        setTimeout(() => {
          const allSlots = document.querySelectorAll(".slot");
          let targetSlot = null;
          allSlots.forEach(s => {
            const attr = s.getAttribute("onclick") || "";
            if (attr.includes(`'${dateKey}'`) && attr.includes(`, ${slot})`)) targetSlot = s;
          });
          if (targetSlot) {
            targetSlot.scrollIntoView({ behavior: "smooth", block: "center" });
            targetSlot.style.transition = "box-shadow 0.2s, transform 0.2s";
            targetSlot.style.boxShadow  = "0 0 0 3px #811419, 0 4px 16px rgba(129,20,25,0.35)";
            targetSlot.style.transform  = "scale(1.03)";
            setTimeout(() => { targetSlot.style.boxShadow = ""; targetSlot.style.transform = ""; }, 1500);
          }
          openPopup(dateKey, slot);
        }, 50);
      });
      return;
    }
  }
  alert("Order not found.");
}

function clearSearch() {
  document.getElementById("searchOrder").value = "";
}

function showMyDeliveries() {
  const name       = document.getElementById("myDeliveriesName").value.trim().toLowerCase();
  const resultsBox = document.getElementById("myDeliveriesResults");
  if (!name) { resultsBox.classList.add("hidden"); return; }

  const matches = Object.keys(deliveries)
    .filter(key => {
      const d = deliveries[key];
      return d && (d.salespersonName || "").toLowerCase().includes(name);
    })
    .sort();

  if (!matches.length) {
    resultsBox.innerHTML = `<h3>My Deliveries</h3><div>No deliveries found for this name.</div>`;
    resultsBox.classList.remove("hidden");
    return;
  }

  resultsBox.innerHTML = `<h3>My Deliveries</h3>` + matches.map(key => {
    const delivery    = deliveries[key];
    const dateKey     = key.split("-slot-")[0];
    const slot        = key.split("-slot-")[1];
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
  renderCalendar().then(() => {
    setTimeout(() => openPopup(dateKey, slot), 50);
  });
}

// ── Order Number Auto-format ───────────────────────────────────────────────
document.getElementById("orderNumber").addEventListener("input", function () {
  if (this.disabled) return;
  let val = this.value.toUpperCase();
  if (!val.startsWith("S")) val = "S" + val.replace(/[^0-9]/g, "");
  else val = "S" + val.slice(1).replace(/[^0-9]/g, "");
  if (val.length > 8) { val = val.slice(0, 8); alert("Order number must be S followed by exactly 7 digits."); }
  this.value = val;
});

// ── Keyboard Shortcuts ─────────────────────────────────────────────────────
document.getElementById("searchOrder").addEventListener("keydown", function(e) {
  if (e.key === "Enter") searchOrder();
});
document.getElementById("myDeliveriesName").addEventListener("keydown", function(e) {
  if (e.key === "Enter") showMyDeliveries();
});

// ── Init ───────────────────────────────────────────────────────────────────
renderCalendar();

// Auto-refresh every 10 seconds when popup is closed
setInterval(() => {
  if (document.getElementById("popup").classList.contains("hidden")) {
    renderCalendar();
  }
}, 10000);