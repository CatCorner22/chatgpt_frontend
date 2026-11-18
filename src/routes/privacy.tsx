import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { useHostedSession } from "@/components/HostedBoundary";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — Focus" },
      {
        name: "description",
        content:
          "How Focus handles account details, design work, screenshots, shared links and visitor analytics.",
      },
      { property: "og:title", content: "Privacy policy — Focus" },
      { property: "og:description", content: "Data handling for the Focus design studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});
function Privacy() {
  const hosted = useHostedSession();
  if (hosted)
    return (
      <LegalPage title="Privacy in this workspace">
        <section>
          <h2>Private access</h2>
          <p>
            This hosted Focus workspace uses ChatGPT sign-in. Focus receives the verified account
            identifier and available email address from the hosting service to select your personal
            workspace. Focus does not ask for or store your ChatGPT password. Contact the person who
            invited you for help with access or stored data.
          </p>
        </section>
        <section>
          <h2>Browser work and signing out</h2>
          <p>
            Your studio work, saved designs, uploaded page images, history, preferences and review
            data are stored in this browser under your account's workspace. They are separated from
            another signed-in account. Signing out does not delete your browser copy; it becomes
            available again when you return to the same account. A person with access to your
            browser profile or device storage may still access those local files. Clearing site
            storage can remove your only local copy.
          </p>
        </section>
        <section>
          <h2>Your optional online library</h2>
          <p>
            When you choose Save library online in My designs, Focus sends a complete library backup
            to private hosted object storage (Cloudflare R2). It includes the saved designs, their
            words and settings, referenced uploaded images, saved versions, and Undo/Redo history.
            It does not include an unfinished studio draft or unrelated browser settings. Restoring
            is explicit and merges the online designs with your browser library.
          </p>
          <p>
            The server selects stored copies using your verified identity; the app provides no
            public image or library URLs. A successful save normally retains the current snapshot
            and one previous snapshot for recovery. Interrupted writes or cleanup failures may leave
            additional snapshots. There is no automatic time-based expiry or online-library deletion
            control in this version; ask the workspace operator about removal. Removing a browser
            design or signing out does not remove online snapshots.
          </p>
        </section>
        <section>
          <h2>Images, downloads and sharing</h2>
          <p>
            Images added to your page are stored in your browser and are included when you save that
            library online. Working-page downloads embed the selected image. Library backups can
            contain several designs, earlier words, history and images. Keep them private and review
            their scope before sending them to someone else. The source snapshot in a page ZIP is an
            archive for developers, not a public website file. Downloaded copies remain under their
            holders' control.
          </p>
        </section>
        <section>
          <h2>Checks and connected services</h2>
          <p>
            Measured public-site checks request the address and selected public stylesheets from the
            site's host; DNS safety checks use a public DNS service. Those services receive the
            requests. Focus does not log in to the checked website. Paid AI generation and
            screenshot AI review are paused in this workspace. Public sharing, live Vision
            publishing, separate account profiles, synced progress and scheduled site monitoring are
            not connected here.
          </p>
        </section>
        <PreparationPrivacy />
        <section>
          <h2>Hosting and fonts</h2>
          <p>
            The hosting and sign-in services process requests to deliver and protect the workspace
            and may retain operational logs under their policies. Focus requests selected preview
            fonts from Google Fonts, which receives network information such as your IP address.
            Exported pages use local fallbacks unless fonts are provided separately.{" "}
            <a href="https://openai.com/policies/privacy-policy/">OpenAI's privacy policy</a>,{" "}
            <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a> and{" "}
            <a href="https://policies.google.com/privacy">Google's privacy policy</a> describe their
            handling of service data.
          </p>
        </section>
      </LegalPage>
    );
  return (
    <LegalPage title="Privacy policy">
      <section>
        <h2>Who operates Focus</h2>
        <p>
          Focus is operated by Blake Reagan in the United States. A public privacy contact has not
          yet been designated. This notice must be completed with a working contact before public
          launch.
        </p>
      </section>
      <section>
        <h2>Account and design information</h2>
        <p>
          Focus uses Lovable Cloud to handle your email address, password-based sign-in, profile
          name and optional business name. Saved account projects, brand builds, progress, watched
          addresses and sharing settings are stored there so they can work across devices. Passwords
          are handled by the sign-in service, not included in design exports.
        </p>
        <p>
          Your browser also stores your session and local studio work, design library, undo history,
          taste preferences, review history and original-page comparisons. Local-only work stays in
          that browser unless you save, share or back it up. Clearing browser storage can remove it
          and sign you out.
        </p>
      </section>
      <section>
        <h2>AI requests and screenshots</h2>
        <p>
          When you request an AI design or review, Focus sends the relevant brief, choices,
          preferences, page evidence or screenshot through Lovable's AI service to OpenAI. Do not
          submit passwords, confidential records or other people's personal information. Screenshots
          are resized in your browser and sent for review; Focus does not save the image in its
          project storage. Review text may remain in browser history or saved progress. The AI
          request asks the provider not to store its response; that is not a promise of zero
          provider retention.
        </p>
        <p>
          <a href="https://lovable.dev/privacy">Lovable's privacy policy</a> and{" "}
          <a href="https://openai.com/policies/privacy-policy/">OpenAI's privacy policy</a> explain
          their handling of service data.
        </p>
      </section>
      <section>
        <h2>Public pages and shared work</h2>
        <p>
          Site checks request the address and selected stylesheets from the site's host. DNS safety
          checks use a public DNS service. The host receives the request. Focus does not log in to
          your website. Site monitor repeats measured checks on watched public addresses.
        </p>
        <p>
          Anyone with a share or live Vision link can read its shared design. A badge proof page is
          public, and opting into the showcase publishes that site's listing. Do not share
          confidential material. Turning off a live link stops future access through that link but
          cannot erase copies already downloaded.
        </p>
      </section>
      <PreparationPrivacy />
      <section>
        <h2>Visitor analytics</h2>
        <p>
          Button and link clicks are recorded for every visitor. Page visits, time on page, page
          speed and errors are also recorded for every visitor, without cookies and without
          identifying anyone. This site currently has no banner passing a consent choice to
          analytics.
        </p>
        <p>
          Lovable's analytics records the pages visited, where visitors came from, their country,
          browser, operating system and device type, how long they stay, how fast pages load, errors
          and clicks. It uses no cookies, stores nothing on the visitor's device, does not keep IP
          addresses and does not identify visitors. Detailed data is kept for 90 days and daily
          summaries for a year.
        </p>
        <p>
          Lovable collects this data for us.{" "}
          <a href="https://lovable.dev/privacy">Lovable's privacy policy</a> explains how it handles
          it.
        </p>
      </section>
      <section>
        <h2>Fonts and other services</h2>
        <p>
          Focus loads fonts from Google Fonts. Your browser requests these from Google, which
          receives network information such as your IP address and browser details. Downloaded
          design packs also include optional Google font links; customers may self-host approved
          fonts or use the supplied fallbacks.{" "}
          <a href="https://policies.google.com/privacy">Google's privacy policy</a> describes its
          handling. The before-and-after example embeds local page content, not an outside video or
          advertising tracker.
        </p>
      </section>
      <section>
        <h2>Retention and your choices</h2>
        <p>
          Browser data remains until you remove it or clear the browser's storage. Saved account
          information remains while needed to provide the service; no automatic account-data expiry
          is currently configured. Hosting logs and backups may retain data under the providers'
          policies. Local library backups and shared downloads are under their holders' control.
        </p>
        <p>
          You can delete saved projects where the app offers deletion, remove local designs and
          preferences, and turn off live links or showcase listings. Account-wide access, correction
          and deletion requests require the public contact that is still awaiting designation.
          Applicable privacy rights depend on where you live; this notice does not limit rights
          provided by law.
        </p>
      </section>
    </LegalPage>
  );
}

function PreparationPrivacy() {
  return (
    <section>
      <h2>Target answers and Telescope files</h2>
      <p>
        Target keeps your preparation answers in this browser's workspace. They are not part of
        online library copies. A Target download includes your project descriptions, task list and
        backup and preview plans. Review those details before sharing the pack or pasting its
        prompts into another tool. Do not include passwords, access tokens or customer records.
      </p>
      <p>
        Telescope reads selected HTML, ZIP and receipt files locally in the open tab. It does not
        execute customer code, fetch its resources, upload the files or save them in browser
        storage. Leaving or reloading removes the session. Downloaded receipts and task plans
        include filenames, observations and the task descriptions you entered; those copies remain
        under their holders' control.
      </p>
    </section>
  );
}
