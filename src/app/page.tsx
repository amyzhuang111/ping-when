import { connection } from "next/server";
import { PingWhen } from "@/components/ping-when";

export const instant = false;

export default async function Home() {
  await connection();
  return <PingWhen />;
}
