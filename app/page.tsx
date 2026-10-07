import Hud from "@/components/hud/Hud";
import { requireSession } from "@/lib/auth";

export default async function Home() {
  await requireSession();
  return <Hud />;
}
