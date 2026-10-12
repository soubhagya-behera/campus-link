import Shell from "./Shell";
import { SessionProvider } from "../store/session";

/**
 * Authenticated app layout.
 *
 * The public landing page renders outside this gate on purpose: it must not
 * wait on, or fail with, the local API's demo-identity request.
 */
export default function WorkspaceLayout() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
