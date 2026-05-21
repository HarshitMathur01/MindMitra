export interface CampusEvent {
  title: string;
  category: "Festival" | "Crisis" | "Academic" | "Social" | "Meme";
  effect: string;
  flavor: string;
}

export const EVENTS: CampusEvent[] = [
  { title: "DJ Night", category: "Festival", effect: "All pieces gain +1 move range for one turn.", flavor: "Speakers from the auditorium. Sleep is cancelled." },
  { title: "Hackathon", category: "Academic", effect: "Night Owls move twice this turn.", flavor: "Forty-eight hours, three Red Bulls, one working demo." },
  { title: "Cultural Fest", category: "Festival", effect: "Freshers may move sideways this turn.", flavor: "Decoration committee has taken the entire ground floor." },
  { title: "LAN Tournament", category: "Social", effect: "Knights become immune to capture for one turn.", flavor: "Hostel block lights up at 2 AM. Headshots only." },
  { title: "Power Cut", category: "Crisis", effect: "No piece may capture this turn.", flavor: "Inverter died. Phones at 4%. Pure darkness." },
  { title: "WiFi Down", category: "Crisis", effect: "Toppers lose long-range movement for one turn.", flavor: "The router blinks red. The library erupts." },
  { title: "Mess Strike", category: "Crisis", effect: "All pieces lose 1 move range until next event.", flavor: "Hunger is a battlefield modifier." },
  { title: "Placement Season", category: "Academic", effect: "Every piece becomes aggressive — captures gain +1 priority.", flavor: "Suits. CVs. Crying in the corridor." },
  { title: "Crush Spotted", category: "Meme", effect: "A random piece skips its next turn.", flavor: "Lost in the canteen. Found nowhere." },
  { title: "Assignment Copied", category: "Meme", effect: "Duplicate one Fresher to an empty adjacent square.", flavor: "Same handwriting, same answers, same prof." },
  { title: "Maggi at 2 AM", category: "Meme", effect: "Restores one fallen piece to your reserve.", flavor: "Two minutes. Always more like seven. Worth it." },
  { title: "Attendance Drive", category: "Academic", effect: "Pieces that didn't move last turn are frozen.", flavor: "Roll number echoes down the hall." },
];
