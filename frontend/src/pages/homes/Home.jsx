import { useApp, getWorld, WORLDS } from "../../context/AppContext";
import ProducerHome from "./ProducerHome";
import DemanderHome from "./DemanderHome";
import DistributorHome from "./DistributorHome";

// Dispatches to a genuinely distinct home dashboard per world - not
// one template with a swapped heading.
export default function Home() {
  const { currentUser } = useApp();
  if (!currentUser) return null;
  const world = getWorld(currentUser.role);

  if (world === WORLDS.PRODUCER) return <ProducerHome />;
  if (world === WORLDS.DISTRIBUTOR) return <DistributorHome />;
  return <DemanderHome />;
}
