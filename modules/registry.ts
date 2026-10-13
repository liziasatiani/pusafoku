import { asAny, type AnyModule } from "@/modules/types";
import clock from "@/modules/clock";
import weather from "@/modules/weather";
import calendar from "@/modules/calendar";
import tasks from "@/modules/tasks";
import notes from "@/modules/notes";
import rss from "@/modules/rss";
import monitor from "@/modules/monitor";
import inbox from "@/modules/inbox";
import messages from "@/modules/messages";
import map from "@/modules/map";

export const MODULES: AnyModule[] = [asAny(clock), asAny(weather), asAny(calendar), asAny(tasks), asAny(notes), asAny(rss), asAny(monitor), asAny(inbox), asAny(messages), asAny(map)];
