import dmSans from "../../assets/vendor-fonts/licenses/dm-sans-OFL.txt?url&no-inline";
import manrope from "../../assets/vendor-fonts/licenses/manrope-OFL.txt?url&no-inline";
import jetBrainsMono from "../../assets/vendor-fonts/licenses/jetbrains-mono-OFL.txt?url&no-inline";

// Publish the original notices with both the hosted studio and the offline reviewer.
export const uiFontLicenses = [
  { title: "Manrope font license", href: manrope },
  { title: "DM Sans font license", href: dmSans },
  { title: "JetBrains Mono font license", href: jetBrainsMono },
].map((font) => ({ ...font, rel: "license", type: "text/plain" }));
