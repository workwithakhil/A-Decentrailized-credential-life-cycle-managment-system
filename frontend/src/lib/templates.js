/**
 * Credential templates an organisation can issue. The template's `type`
 * becomes the W3C credential type and, hashed, the on-chain schemaId —
 * which is how a verifier can insist on one kind of credential.
 */
import { schemaId } from "./credential";
import { humanize } from "./format";

export const TEMPLATES = [
  {
    type: "StudentCredential",
    name: "Student ID",
    blurb: "Enrolment at a school, college or university.",
    icon: "badge",
    fields: [
      { key: "name", label: "Full name" },
      { key: "rollNumber", label: "Roll number" },
      { key: "programme", label: "Programme", placeholder: "B.Tech Computer Science" },
      { key: "enrolmentStatus", label: "Enrolment status", kind: "select", options: ["Active", "Graduated", "On leave"] },
      { key: "dateOfBirth", label: "Date of birth", kind: "date" },
      { key: "graduationYear", label: "Graduation year", kind: "number", placeholder: "2027" },
    ],
  },
  {
    type: "DegreeCredential",
    name: "Degree certificate",
    blurb: "A completed degree, diploma or certification.",
    icon: "award",
    fields: [
      { key: "name", label: "Full name" },
      { key: "degree", label: "Degree", placeholder: "Bachelor of Technology" },
      { key: "major", label: "Major / specialisation" },
      { key: "grade", label: "Grade or CGPA" },
      { key: "awardedOn", label: "Awarded on", kind: "date" },
    ],
  },
  {
    type: "EmploymentCredential",
    name: "Proof of employment",
    blurb: "Current or past employment with an organisation.",
    icon: "briefcase",
    fields: [
      { key: "name", label: "Full name" },
      { key: "employeeId", label: "Employee ID" },
      { key: "jobTitle", label: "Job title" },
      { key: "department", label: "Department" },
      { key: "employmentType", label: "Employment type", kind: "select", options: ["Full-time", "Part-time", "Contract", "Intern"] },
      { key: "startDate", label: "Start date", kind: "date" },
    ],
  },
  {
    type: "MembershipCredential",
    name: "Membership card",
    blurb: "Membership of a club, society or programme.",
    icon: "card",
    fields: [
      { key: "name", label: "Full name" },
      { key: "memberId", label: "Member ID" },
      { key: "tier", label: "Tier", kind: "select", options: ["Standard", "Silver", "Gold", "Platinum"] },
      { key: "memberSince", label: "Member since", kind: "date" },
    ],
  },
  {
    type: "AgeCredential",
    name: "Proof of age",
    blurb: "Date of birth and nationality, for age-restricted services.",
    icon: "calendar",
    fields: [
      { key: "name", label: "Full name" },
      { key: "dateOfBirth", label: "Date of birth", kind: "date" },
      { key: "nationality", label: "Nationality" },
    ],
  },
];

const BY_SCHEMA = Object.fromEntries(
  TEMPLATES.map((t) => [schemaId(t.type).toLowerCase(), t])
);

export const templateBySchema = (id) => BY_SCHEMA[String(id).toLowerCase()];
export const templateByType = (type) => TEMPLATES.find((t) => t.type === type);

export function fieldLabel(key, type) {
  return templateByType(type)?.fields.find((f) => f.key === key)?.label || humanize(key);
}

export const typeName = (type) => templateByType(type)?.name || (type ? humanize(type) : "Any credential");
