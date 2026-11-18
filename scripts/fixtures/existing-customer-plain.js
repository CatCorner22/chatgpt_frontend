// Bind the equivalent plain HTML fixture without changing its markup or styles.
const main = document.querySelector("main#trial");
const form = main?.querySelector("form");
const email = main?.querySelector('input[name="email"]');
const status = main?.querySelector('p[role="status"]');
const increment = main?.querySelector("#increment");
const count = main?.querySelector("#count");
const details = main?.querySelector('a[href="#details"]');
const route = main?.querySelector("[data-route]");
const portalAction = document.querySelector("#portal-action");
const portalCount = document.querySelector("#portal-count");

if (
  !main ||
  !form ||
  !email ||
  !status ||
  !increment ||
  !count ||
  !details ||
  !route ||
  !portalAction ||
  !portalCount
) {
  throw new Error("The plain customer fixture is missing a required task control.");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  status.textContent = `Booked ${email.value}`;
});
increment.addEventListener("click", () => {
  count.textContent = String(Number(count.textContent) + 1);
});
details.addEventListener("click", () => {
  route.textContent = "Details";
});
portalAction.addEventListener("click", () => {
  portalCount.textContent = String(Number(portalCount.textContent) + 1);
});
