# Test L10 Meeting Transcript

**Meeting Title:** Caldera Leadership L10 Weekly Meeting  
**Date:** January 30, 2026  
**Participants:** Rich Boatman, Wade Evanhoff, John Oneill  
**Duration:** 90 minutes  
**Recording Source:** Zoom (Speaker Diarized)

---

## Transcript

**[00:00 - Segue]**

Rich: All right, gentlemen. It is 1 o'clock on the dot, let's get rolling. Segue. Who's got good news? Personal or professional, let's hear it.

Wade: I'll go. So my daughter had her first gymnastics competition this past weekend. She got third place on the beam. I mean, she's six, so they all basically get a ribbon, but she was fired up about it. It was awesome.

Rich: That's great, man. Love that.

John: Nice. All right. Mine is professional. I finally got my home office fully dialed in. New monitor, new standing desk, cable management. It's like a whole new world. I'm not tripping over cords anymore.

Rich: The standing desk life is real. Good for you. Mine's quick. Angie and I did a date night Saturday. First one in like two months. Went to that new Italian place downtown. Highly recommend the bolognese.

Wade: Look at you. Living the dream.

Rich: All right, good stuff. Let's move into the scorecard.

---

**[05:02 - Scorecard]**

Rich: Okay, I'm sharing the dashboard now. Let's run through it. Wade, billable utilization?

Wade: Utilization came in at 78 percent this week. We're on track. Goal is 75.

Rich: Good. Effective billable rate?

Wade: Effective billable rate is at 142 dollars an hour. That's off track. Goal is 150. It dropped because of the scope creep on the Heartland project. We burned a bunch of hours on QA rework that wasn't in the original estimate.

Rich: Okay. Drop that down to the issues list. John, weighted pipeline value?

John: Pipeline is at 4.2 million. On track. We need 3x our monthly burn which is about 3.6, so we're sitting above that.

Rich: Good. Sales activities, discovery calls booked?

John: We had 3 discovery calls this week. That's off track. Goal is 5. I had two cancellations. One was the Marriott contact who rescheduled to next week, and the other was a cold lead that just ghosted.

Rich: Drop it down. Sprint velocity variance?

Wade: Variance is at 8 percent. On track. Goal is under 10. The team's been pretty consistent the last few sprints.

Rich: Bug density?

Wade: Bug density is 0.3 critical bugs per sprint. On track. Under 0.5 target.

Rich: Revenue recognized this month?

John: We recognized 285,000 in January. That's on track against the monthly goal of 275.

Rich: All right. Good. A couple off track items, we've got them captured. Moving on.

---

**[10:15 - Rock Review]**

Rich: Rock review. Let's go through our Q1 rocks. John, your rock is to close 500K in new AI-focused engagements by end of Q1. Status?

John: On track. We've closed 180K so far with the ServiceNow deal and the AR Phase 2 work. Pipeline has another 400K in proposals out. Feeling good about hitting it.

Rich: Good. Wade, your rock is to implement the new CI/CD pipeline and reduce deployment time by 50 percent.

Wade: Off track. We've made progress on the infrastructure side, but the migration for the Heartland and Cochrane projects is more complex than we scoped. Realistically we're about 30 percent done. I'm concerned we won't hit it by end of March unless we reallocate some resources.

Rich: Okay. Drop that to issues. My rock is to finalize the EOS tooling build and have the AI meeting parser in MVP by end of Q1. I'm on track. We've got the transcription pipeline working and the intent classification is in testing now. That's literally why we're generating this transcript.

Wade: Meta.

Rich: Very meta. All right, let's move to headlines.

---

**[15:08 - Headlines]**

John: Headline. Audience Rewards signed the Apple Pay and Google Pay integration SOW. That's 25K kicking off in February.

Rich: Great news.

Wade: Headline. Alex shipped the first version of the AI code review tool for internal use. The dev team has been using it for a week and the feedback is really positive.

Rich: Love it.

John: One more. I had a really strong intro call with a fintech company out of Chicago called NovaPay. They're looking for a full platform rebuild. Could be a big one, 300K range.

Rich: Nice.

Wade: Employee headline. Zach passed his AWS Solutions Architect cert. He's been grinding on that for two months.

Rich: Good for him. Let's make sure we recognize that in the team Slack channel. All right, to-do list.

---

**[19:45 - To-Do List]**

Rich: Okay, let's review last week's to-dos. Wade, you had "send revised estimate to Heartland for the Phase 3 scope." Done or not done?

Wade: Done. Sent it Wednesday. They're reviewing it now.

Rich: John, you had "schedule follow-up call with Constance at Audience Rewards about the pay integration kickoff."

John: Done. We're meeting with her Tuesday.

Rich: Good. Wade, you had "set up QA sandbox environment for the AI testing framework."

Wade: Not done. I got pulled into the Cochrane deployment fire on Thursday and couldn't get to it. Keeping it for this week.

Rich: Okay. John, you had "send the NovaPay proposal draft to Rich and Wade for review."

John: Not done. They pushed back their timeline. They said they need two more weeks to finalize their internal requirements. So I'm going to drop it to issues because I'm worried about the delay and whether they're actually serious.

Rich: Okay, dropped. I had "review and approve the Q1 budget reforecast." Done. Sent it to our accountant Friday. All right, that's 3 out of 5 done. 60 percent. We want to be hitting 90. Let's tighten that up. Moving into IDS.

---

**[24:30 - IDS]**

Rich: All right, IDS time. This is where we earn our money. Let's look at the issues list. We've got the ones we just dropped down plus the carryovers from last week. Let me read them off and then we prioritize.

One: Effective billable rate is off track due to scope creep on Heartland.
Two: Discovery calls booked is off track, only 3 of 5.
Three: CI/CD pipeline rock is off track.
Four: NovaPay may be stalling.
Five: Carryover from last week, QA team is not adopting AI tooling fast enough.
Six: Carryover, we still don't have a documented sales-to-delivery handoff process.

Which three are the most important? I think number one, number five, and number six are the big ones. What do you guys think?

John: I agree. The pipeline stuff, I can handle the NovaPay thing and the discovery calls on my own. Those are execution issues. The systemic ones are bigger.

Wade: Yeah. Let's do one, five, and six.

---

**[26:15 - IDS Issue 1: Effective Billable Rate / Heartland Scope Creep]**

Rich: Okay. Issue one. Effective billable rate dropped to 142 because of Heartland scope creep. Wade, identify the root cause for us.

Wade: So here's what happened. The original SOW for Heartland Phase 2 was a fixed-fee engagement at 45K. We estimated 300 hours. But the client kept adding requirements to the QA acceptance criteria after each sprint review. Things like, oh, we also need this edge case tested, or can you add coverage for this integration we forgot to mention. And our team just kept doing the work without flagging it because they didn't want to be the ones pushing back on the client.

John: I think the root cause isn't really Heartland specifically. It's that we don't have a change order process. Like, when a client asks for something outside scope, there's no mechanism for the dev team to say, hey, this is a change order, it needs to go through John or whoever owns the relationship.

Rich: That's exactly right. So the root cause is we have no change order process, and the team doesn't feel empowered to push back on scope additions.

Wade: I agree. The devs shouldn't have to be the ones saying no. That's a project management gap.

Rich: Okay, so what's the solve?

John: I think we need a simple change order template. Like a one-pager. If the client requests work that wasn't in the original SOW, the developer fills out the form, it goes to the project lead, and the project lead loops in sales to either approve it as a goodwill gesture or sends the client a change order with the additional cost.

Wade: Yeah. And I think we need to train the team on it. Not just send an email. Like actually walk through a scenario in the next team standup so they know it's okay to use it.

Rich: I love it. So the solution is we create a change order template and process, and we train the team on it. John, I'll take the template. I'll have a draft by next week. Wade, can you own the training piece? Do a walkthrough at next Friday's team standup?

John: I'll take the template actually. I know the SOW language best. I'll have it done by Wednesday.

Wade: Yeah, I'll handle the training. I'll put it on the agenda for Friday's standup.

Rich: Perfect. To-do, John, create change order template by Wednesday. To-do, Wade, train team on change order process at Friday standup. Let's also put a to-do on me to add effective billable rate as a standing agenda item so we're watching it every week. Actually, it's already on the scorecard. Never mind. Okay, that one's solved. Next.

---

**[38:42 - IDS Issue 2: QA Team Not Adopting AI Tooling]**

Rich: Issue five. QA team not adopting AI tooling fast enough. This has been on the list for three weeks now. Who wants to identify?

Wade: I'll take it. So the concern here is that our dev team, especially Alex and Jeanne, they're crushing it with AI-assisted development. Alex built that internal code review tool, Jeanne is using Claude for spec-driven development. But QA is still doing everything manually. They're not experimenting with AI-powered testing frameworks, they're not using any automation beyond what we set up two years ago. And as our dev throughput increases because of AI, QA is becoming the bottleneck. We can't improve our delivery speed if testing is still running at the old pace.

John: I think this is also a sales issue. We talked about this a few weeks ago. There's a real market opportunity for AI QA audits as a service offering. Like, these enterprise clients whose dev teams are adopting AI but their QA teams aren't. That's a bottleneck we could help them solve. But we can't sell that if our own QA team isn't doing it.

Rich: Right. So let me make sure I'm identifying the root cause correctly. Is it that the QA team doesn't know about the tools, doesn't want to use them, or doesn't have time to experiment?

Wade: Honestly, I think it's a leadership gap on my part. I haven't set a clear expectation or given them a specific objective. I've been kind of hoping they'd self-direct into it the way the devs did. But the devs are naturally more tool-curious. QA needs more structure and a clear mandate.

Rich: So the root cause is that we haven't set a clear vision and objective for the QA team around AI adoption.

Wade: Yeah. That's fair.

John: And I'd add, they don't have a sandbox to play in. The devs have side projects and internal tools they can experiment on. QA doesn't have a low-stakes environment to try AI testing tools.

Rich: Good point. So what's the solve?

Wade: I think I need to sit down with the QA team, lay out the vision, show them what the devs are doing, and give them a specific rock. Something like, by end of Q1, evaluate three AI testing frameworks and run a pilot on one of our internal projects.

John: And from a sales perspective, I can frame it for them as a revenue opportunity. Like, hey, if you guys build this capability, we can sell it. That makes them part of the business development, not just a support function.

Rich: I like that. It's the same thing we said a few weeks back. Set the vision, let them build the process, give them a sandbox. Wade, I'll put a to-do on you to schedule a dedicated session with the QA team this week to present the AI testing vision and set their rock. John, to-do on you to put together a one-pager on the AI QA audit service offering so they can see the business case.

Wade: I'll get that on the calendar for Thursday.

John: I'll have the one-pager done by Friday. I can pull from the pitch deck we've already got.

Rich: Great. Solved. Let's move to the last one.

---

**[55:18 - IDS Issue 3: No Documented Sales-to-Delivery Handoff Process]**

Rich: Issue six. We still don't have a documented sales-to-delivery handoff process. This is the one we keep pushing and it keeps biting us. John, identify.

John: So the problem is pretty straightforward. When I close a deal, the handoff to Wade and the dev team is basically me jumping on a call and saying, here's what we sold, here's the contact, good luck. There's no formal document that captures what was promised, the technical assumptions, the timeline commitments, the client's expectations versus what's actually in the SOW. And that's how we end up with situations like Heartland where the dev team doesn't know exactly what was scoped and the client thinks they were promised more than they were.

Wade: Can confirm. Like, every new project kickoff I'm spending the first week just figuring out what John actually sold. No offense, man.

John: None taken. It's a real problem. And it's on me.

Rich: Root cause. We have no handoff document or process that bridges the gap between what sales promises and what delivery executes.

John: That's it. And honestly, I think this is also tied to Issue 1. The scope creep on Heartland started because the team didn't have a clear picture of what was in scope and what wasn't.

Rich: Agreed. These two issues are connected. So what's the solve?

Wade: I think we need a handoff template. A document that John fills out for every closed deal. It should include the SOW summary, the key deliverables, the technical assumptions, any verbal promises or soft commitments made during the sales process, the client stakeholders and their expectations, and the timeline.

John: I'm fine with that. But I'd also want a kickoff call format. Like, once the doc is done, we do a 30-minute kickoff between sales and delivery before the client-facing kickoff. So Wade or whoever the project lead is can ask questions and flag anything that doesn't make sense.

Rich: I love both of those. So the solution is a handoff template plus a mandatory internal kickoff call before any client-facing kickoff. John, you own creating the template. Wade, can you define what the internal kickoff agenda should look like?

John: I'll have the template done by next Thursday. I'll base it off the SOW structure we already use.

Wade: Yeah, I'll draft the kickoff agenda. I can get that done by Wednesday so John can reference it when he's building the template.

Rich: Perfect. To-do, John, create sales-to-delivery handoff template by next Thursday. To-do, Wade, draft internal kickoff meeting agenda by Wednesday. And let me put a to-do on myself to update our project intake process documentation once both of those are done. I'll have that by the following Friday, February 13th.

John: This is going to save us so many headaches.

Wade: Honestly, this is probably the most impactful thing we've done in a month.

Rich: Agreed. All right, that's our three. I think we crushed IDS today. Let's close it out.

---

**[82:30 - Conclude]**

Rich: All right. Conclude. Let me recap the new to-dos from today.

One. John, create change order template by Wednesday, February 4th.
Two. Wade, train team on change order process at Friday standup, February 6th.
Three. Wade, schedule QA team AI vision session by Thursday, February 5th.
Four. John, create AI QA audit service one-pager by Friday, February 6th.
Five. John, create sales-to-delivery handoff template by Thursday, February 12th.
Six. Wade, draft internal kickoff meeting agenda by Wednesday, February 4th.
Seven. Rich, update project intake process documentation by Friday, February 13th.

Everybody good with those?

Wade: Good.

John: All confirmed.

Rich: All right. Rate the meeting. I'll go first. I'd give it a 9. We solved real stuff today. The IDS was fire.

John: I'll say 9 as well. We tackled issues we've been avoiding and the solutions feel actionable.

Wade: I'm going to go 8. Only because we had two to-dos not done from last week. But the IDS was probably the best we've had. So 8.

Rich: Fair enough. Average is 8.7. I'll take it. All right, same time next week. Good meeting, guys.

Wade: Good meeting.

John: See you guys.

---

## AI Parsing Test Notes

This transcript is designed to test extraction of the following:

### Expected Scorecard Entries
| Metric | Value | Status | Speaker |
|--------|-------|--------|---------|
| Billable Utilization | 78% | On Track (goal: 75%) | Wade |
| Effective Billable Rate | $142/hr | Off Track (goal: $150/hr) | Wade |
| Weighted Pipeline Value | $4.2M | On Track (goal: $3.6M) | John |
| Discovery Calls Booked | 3 | Off Track (goal: 5) | John |
| Sprint Velocity Variance | 8% | On Track (goal: <10%) | Wade |
| Bug Density | 0.3 | On Track (goal: <0.5) | Wade |
| Revenue Recognized | $285K | On Track (goal: $275K) | John |

### Expected Issues Identified
1. EBR off track due to Heartland scope creep → SOLVED (change order process + training)
2. QA team not adopting AI tooling → SOLVED (vision session + service offering one-pager)
3. No sales-to-delivery handoff process → SOLVED (handoff template + internal kickoff agenda)
4. Discovery calls off track (kept by John, not IDS'd)
5. NovaPay stalling (kept by John, not IDS'd)

### Expected To-Dos Extracted
| To-Do | Assignee | Due Date |
|-------|----------|----------|
| Create change order template | John | Feb 4 |
| Train team on change order process at Friday standup | Wade | Feb 6 |
| Schedule QA team AI vision session | Wade | Feb 5 |
| Create AI QA audit service one-pager | John | Feb 6 |
| Create sales-to-delivery handoff template | John | Feb 12 |
| Draft internal kickoff meeting agenda | Wade | Feb 4 |
| Update project intake process documentation | Rich | Feb 13 |

### Expected Rocks Status
| Rock | Owner | Status |
|------|-------|--------|
| Close $500K in new AI-focused engagements by end of Q1 | John | On Track |
| Implement new CI/CD pipeline, reduce deployment time by 50% | Wade | Off Track |
| Finalize EOS tooling build, AI meeting parser MVP by end of Q1 | Rich | On Track |

### Expected Headlines
1. Audience Rewards signed Apple Pay / Google Pay integration SOW — $25K starting Feb (John)
2. Alex shipped first version of AI code review tool for internal use (Wade)
3. Strong intro call with NovaPay — potential $300K platform rebuild (John)
4. Zach passed AWS Solutions Architect cert (Wade)

### Prior To-Do Review
| To-Do | Owner | Status |
|-------|-------|--------|
| Send revised estimate to Heartland for Phase 3 scope | Wade | Done |
| Schedule follow-up call with Constance at AR about pay integration kickoff | John | Done |
| Set up QA sandbox environment for AI testing framework | Wade | Not Done (keeping) |
| Send NovaPay proposal draft to Rich and Wade for review | John | Not Done (dropped to issues) |
| Review and approve Q1 budget reforecast | Rich | Done |

### Meeting Rating
- Rich: 9
- John: 9
- Wade: 8
- Average: 8.7
