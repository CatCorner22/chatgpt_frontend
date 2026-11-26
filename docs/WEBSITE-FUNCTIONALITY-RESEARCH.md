# Adding functionality to a Focus website

Focus already lets an owner link the main button to a real booking page, email address, or other destination. The same renderer produces the preview, standalone HTML, and editable ZIP. The page can show native disclosures and follow links. Features that receive a message, reserve a time, or charge money need a service that can record the outcome. [Working-page settings](../src/components/AuthoredPageEditor.tsx) · [Website export](../src/lib/render-authored-page.ts)

## What an owner would choose

Put an optional **Add functionality** button beside the working preview. Show choices in terms of what the visitor can do. Reverie explains what the owner needs to provide and what the visitor will see.

| Choice | Inputs from the owner | Acceptance check |
| --- | --- | --- |
| **Book a time** | A published scheduling link, the appointment name, and any price or preparation details the visitor needs before leaving the page | Follow the link from the exported page and make a test booking. Find the event in the calendar. |
| **Request an estimate** | A public submission endpoint from a supported service, a reply email field, and the few details needed to respond | Submit a synthetic inquiry from the hosted export. Find its unique text in the service dashboard. Test the missing-field and rejected-submission paths. |
| **Find the right service** | The actual services and a short set of meaningful distinctions, such as location, budget, or appointment type | Reach the right service and its action by keyboard and on a phone. Check a result, an empty result, and a way to clear the choices. |

Booking is the shortest path because the existing action control already accepts a URL. A guided choice can add the language, destination, and test instructions for a particular task. Google Calendar publishes a booking page and records scheduled appointments. [Google Calendar appointment schedules](https://support.google.com/calendar/answer/10733297?hl=en)

A test booking URL with two query parameters survived all five layouts in both authored export formats. The new-project developer specification omitted that URL. A guided action needs to carry the exact destination into the developer handoff as well. [Studio specification](../src/routes/-studio/Vision.tsx) · [Target pack](../src/lib/target.ts)

**Request an estimate** is the strongest first addition to the renderer. It lets a visitor complete an action the current standalone download cannot handle. One supported provider keeps setup and failure behavior predictable. Netlify Forms already demonstrates HTML form detection and stored submissions on a supported host. An owner-configured HTTPS submission service could also receive standard HTML form data from other hosts. [HTML form standard](https://html.spec.whatwg.org/multipage/forms.html#the-form-element) · [Netlify form setup](https://docs.netlify.com/manage/forms/setup/) · [Netlify submission records](https://docs.netlify.com/manage/forms/submissions/)

## How the estimate request would work

1. The owner picks the fields, writes the labels and explains what happens after submitting. The preview shows realistic empty, invalid and completed examples with made-up data.
2. The owner pastes the public form URL from the supported provider. The exported page includes labeled fields and sends a standard form submission to that service. The provider handles its result page. Focus can export an unfinished design with a disabled preview, then enable the form for use once it has a destination.
3. **Target** rehearses the exported page locally with a fixture service. It checks keyboard order, narrow and wide layouts, error wording, and preservation of entered details where the service supports it. The owner checks the actual hosted page and confirms receipt in the provider dashboard. Clicking Submit, seeing a confirmation, and finding a stored inquiry are separate observations.

Use accessible text for field errors and clear next steps after a successful request. Preserve the feature choice in the saved design, undo history, library backup, and the exact exported files. Keep endpoint keys and test messages out of Focus. For an existing site, use this as a developer handoff with a preview and rollback plan. Installing a form or booking provider on an existing service is a different change from applying the current styling pack. [W3C form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/) · [WCAG error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) · [GOV.UK confirmation pages](https://design-system.service.gov.uk/patterns/confirmation-pages/)

## How to measure progress toward the North Star

Give a Focus build and an independent designer the same real brief, content and working destination. Ask visitors to find the right service and submit a request on both pages. Record completion, error recovery, clarity about what happens next, and whether the request actually arrived. Collect visual preference separately in the Review Room. This tests whether the addition helps someone complete a task. [North Star review](NORTH-STAR-REVIEW-2026-11-25.md)
