import { Element, Slide } from './types';

function numericSuffix(id: string): number {
  const match = /^([a-z]+)(\d+)$/.exec(id);
  return match ? Number(match[2]) : Number.POSITIVE_INFINITY;
}

/**
 * The lead element of a group: the member with the lowest numeric element id.
 * The lead owns the `members` list; every other member only carries `group`.
 */
export function groupLead(slide: Slide, group: string): Element | undefined {
  let lead: Element | undefined;
  for (const el of slide.elements) {
    if (el.type === 'connector' || el.group !== group) continue;
    if (!lead || numericSuffix(el.id) < numericSuffix(lead.id)) lead = el;
  }
  return lead;
}

/**
 * Ids of every group member except the lead itself, from the lead's `members`
 * list when present and otherwise derived from the shared `group` tag (so old
 * decks that only set the tag keep working).
 */
export function groupMemberIds(groups: Slide, group: string): string[] {
  const all = groups.elements.filter((el) => el.type !== 'connector' && el.group === group);
  const lead = groupLead(groups, group);
  const listed = lead?.members;
  if (listed && Array.isArray(listed)) {
    const known = new Set(all.map((el) => el.id));
    const leadId = lead?.id;
    return [...new Set(listed)].filter((id) => id !== leadId && known.has(id));
  }
  return all
    .filter((el) => el.id !== lead?.id)
    .map((el) => el.id)
    .sort((a, b) => numericSuffix(a) - numericSuffix(b));
}

/**
 * Restore the group invariant on a slide: the lowest-id member is the lead and
 * holds the full member list; non-leads drop their own lists. Call after any
 * operation that adds, removes or regroups members.
 */
export function repairGroups(slide: Slide): void {
  const byGroup = new Map<string, Element[]>();
  for (const el of slide.elements) {
    if (el.type === 'connector' || !el.group) continue;
    const bucket = byGroup.get(el.group) ?? [];
    bucket.push(el);
    byGroup.set(el.group, bucket);
  }
  // Drop stale member lists everywhere first, then rebuild the lead's list.
  for (const el of slide.elements) {
    if (el.members && el.members.length > 0) delete el.members;
  }
  for (const [group, members] of byGroup) {
    const lead = groupLead({ ...slide, elements: members } as Slide, group);
    if (!lead) continue;
    const rest = members
      .filter((el) => el.id !== lead.id)
      .map((el) => el.id)
      .sort((a, b) => numericSuffix(a) - numericSuffix(b));
    if (rest.length > 0) lead.members = rest;
  }
}
