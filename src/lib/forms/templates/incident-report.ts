import type { FieldOption, FormField, FormSchema } from '@/lib/forms/schema';

function id(): string {
  return crypto.randomUUID();
}

function opt(label: string): FieldOption {
  return { id: id(), label };
}

function opts(labels: string[]): FieldOption[] {
  return labels.map((label) => opt(label));
}

/** Pre-built schema matching a typical A2A Incident Report Form structure. */
export function createIncidentReportSchema(): FormSchema {
  const pageId = id();

  const logo = id();
  const participantSection = id();
  const participantName = id();
  const location = id();
  const incidentSection = id();
  const staffName = id();
  const incidentDate = id();
  const incidentTime = id();
  const incidentDuration = id();
  const incidentType1 = id();
  const incidentType2 = id();
  const beforeIncident = id();
  const describeIncident = id();
  const afterIncident = id();
  const functionOfBehaviour = id();
  const restrictedPractices = id();
  const restrictedPracticeTypes = id();
  const staffDistress = id();
  const declaration = id();
  const reviewerSection = id();
  const reviewerName = id();
  const reviewerTitle = id();
  const reviewDate = id();
  const reportStage = id();
  const severity = id();
  const participantDebrief = id();
  const staffDebrief = id();
  const nextAction = id();
  const stakeholdersSection = id();
  const sendTo = id();

  const incidentType1Options = opts([
    'Disclosure of Information',
    'Allegations',
    'Hospital Admission',
    'Unauthorised Hospital Discharge',
    'Emergency Services Contacted',
    'Fall/Fall Risk',
    'Risk to Staff Safety',
    'Injury to Staff',
    'Awake Hours',
    'Missed Medication',
    'Medication Overdose',
    'Vehicle Accident/Damage',
  ]);

  const incidentType2Options = opts([
    'Physical Aggression',
    'Verbal Aggression',
    'Threats of Violence',
    'Property Damage',
    'Harm to Others',
    'Unauthorised Use of Restricted Practice',
    'Absconding',
    'Self-Harm',
    'Suicidal Ideation',
    'Suicide Attempt',
    'Substance Use / Abuse',
    'Sexualised Behaviour',
    'Sexual Assault',
    'Other',
  ]);

  const restrictedPracticeOptions = opts([
    'Chemical - Offered a PRN',
    'Seclusion - Isolate yourself within the office or confine them within a room.',
    'Removed Object - Sharps, Lighters etc',
    'Physical Restraint',
  ]);

  const sendToOptions = opts([
    'Support Coordinator',
    'Behaviour Support Practitioner',
    'Family Members',
    'Guardian',
    'Allied Health Professionals',
    'Other',
  ]);

  const yesOption = opt('Yes');
  const noOption = opt('No');
  const yesUnauthorisedOption = opt('Yes - Unauthorised Restricted Practice');

  const fields: Record<string, FormField> = {
    [logo]: { id: logo, type: 'image', label: 'Company logo', required: false },
    [participantSection]: {
      id: participantSection,
      type: 'section_break',
      label: 'PARTICIPANT DETAILS',
      required: false,
    },
    [participantName]: {
      id: participantName,
      type: 'short_text',
      label: "Participant's Name",
      required: true,
    },
    [location]: {
      id: location,
      type: 'short_text',
      label: 'Location of Incident',
      required: true,
    },
    [incidentSection]: {
      id: incidentSection,
      type: 'section_break',
      label: 'INCIDENT DETAILS',
      required: false,
      helpText:
        'IMPORTANT: When completing an incident report, ensure all information is factual, objective, and based only on what you saw, heard, or were told. Do not include opinions, assumptions, or speculation. Clearly document who was involved, what occurred, and when and where the incident happened, recorded in chronological order. Include all actions taken, notifications made, and any follow-up required to demonstrate that appropriate procedures were followed.\n\nIf additional factual information becomes available after the initial incident report has been completed (e.g. during a post-incident debrief), it may be added to the report, with the understanding that Clickforms maintains an audit trail of all changes.',
    },
    [staffName]: { id: staffName, type: 'short_text', label: 'Staff Name', required: true },
    [incidentDate]: {
      id: incidentDate,
      type: 'date',
      label: 'Date of Incident',
      required: true,
      width: 'third',
    },
    [incidentTime]: {
      id: incidentTime,
      type: 'time',
      label: 'Time of Incident',
      required: true,
      width: 'third',
    },
    [incidentDuration]: {
      id: incidentDuration,
      type: 'short_text',
      label: 'How Long Did The Incident Last?',
      required: true,
      width: 'third',
    },
    [incidentType1]: {
      id: incidentType1,
      type: 'checkbox',
      label: 'Type of Incident I',
      required: false,
      width: 'half',
      options: incidentType1Options,
    },
    [incidentType2]: {
      id: incidentType2,
      type: 'checkbox',
      label: 'Type of Incident II',
      required: false,
      width: 'half',
      options: incidentType2Options,
    },
    [beforeIncident]: {
      id: beforeIncident,
      type: 'paragraph',
      label: 'What Happened Before The Incident',
      required: true,
    },
    [describeIncident]: {
      id: describeIncident,
      type: 'paragraph',
      label: 'Describe The Incident',
      required: true,
    },
    [afterIncident]: {
      id: afterIncident,
      type: 'paragraph',
      label: 'What Happened After The Incident',
      required: true,
    },
    [functionOfBehaviour]: {
      id: functionOfBehaviour,
      type: 'dropdown',
      label: 'Function of Behaviour',
      required: true,
      options: opts([
        'Access - To an Item or Activity',
        'Escape - To get away from something, somebody or a bad feeling',
        'Attention - To get Attention or Help',
        'Rewards - To get something they want',
        'Sensory - To experience a specific sensation',
        'N/A',
      ]),
    },
    [restrictedPractices]: {
      id: restrictedPractices,
      type: 'multi_choice',
      label: 'Did You Use Any Restricted Practices?',
      required: true,
      options: [yesOption, noOption, yesUnauthorisedOption],
    },
    [restrictedPracticeTypes]: {
      id: restrictedPracticeTypes,
      type: 'checkbox',
      label: 'Restricted practice types used',
      required: false,
      options: restrictedPracticeOptions,
    },
    [staffDistress]: {
      id: staffDistress,
      type: 'multi_choice',
      label:
        'Have you experienced any emotional or physical distress as a result of this incident, and do you need a manager to contact you immediately?',
      required: true,
      options: [opt('Yes'), opt('No')],
    },
    [declaration]: {
      id: declaration,
      type: 'signature',
      label: 'I declare the information I have provided is true and correct',
      required: true,
    },
    [reviewerSection]: {
      id: reviewerSection,
      type: 'section_break',
      label: 'REVIEWER TO COMPLETE',
      required: false,
    },
    [reviewerName]: {
      id: reviewerName,
      type: 'short_text',
      label: 'Name of Reviewer',
      required: false,
      width: 'half',
    },
    [reviewerTitle]: {
      id: reviewerTitle,
      type: 'short_text',
      label: 'Title',
      required: false,
      width: 'half',
    },
    [reviewDate]: {
      id: reviewDate,
      type: 'date',
      label: 'Date of Review',
      required: false,
      width: 'half',
    },
    [reportStage]: {
      id: reportStage,
      type: 'dropdown',
      label: 'Incident Report Stage',
      required: false,
      width: 'half',
      options: opts(['Open', 'Investigating', 'Closed']),
    },
    [severity]: {
      id: severity,
      type: 'dropdown',
      label: 'Severity',
      required: false,
      options: opts([
        '1: Reportable But Not Impactful',
        '2: Potential To Cause Harm',
        '3: Potential To Cause Extensive Harm',
        '4: Serious Impact',
        '5: Severe Impact',
      ]),
    },
    [participantDebrief]: {
      id: participantDebrief,
      type: 'paragraph',
      label: 'Participant Debrief',
      required: false,
    },
    [staffDebrief]: {
      id: staffDebrief,
      type: 'paragraph',
      label: 'Staff Debrief',
      required: false,
    },
    [nextAction]: {
      id: nextAction,
      type: 'paragraph',
      label: 'Next Course Of Action',
      required: false,
    },
    [stakeholdersSection]: {
      id: stakeholdersSection,
      type: 'section_break',
      label: 'STAKEHOLDERS NOTIFIED',
      required: false,
    },
    [sendTo]: {
      id: sendTo,
      type: 'checkbox',
      label: 'Send To',
      required: false,
      options: sendToOptions,
    },
  };

  return {
    pages: [
      {
        id: pageId,
        title: 'Incident Report',
        fields: [
          logo,
          participantSection,
          participantName,
          location,
          incidentSection,
          staffName,
          incidentDate,
          incidentTime,
          incidentDuration,
          incidentType1,
          incidentType2,
          beforeIncident,
          describeIncident,
          afterIncident,
          functionOfBehaviour,
          restrictedPractices,
          restrictedPracticeTypes,
          staffDistress,
          declaration,
          reviewerSection,
          reviewerName,
          reviewerTitle,
          reviewDate,
          reportStage,
          severity,
          participantDebrief,
          staffDebrief,
          nextAction,
          stakeholdersSection,
          sendTo,
        ],
      },
    ],
    fields,
    conditionalLogic: [
      {
        fieldId: restrictedPracticeTypes,
        showIf: {
          fieldId: restrictedPractices,
          operator: 'equals',
          value: yesOption.id,
        },
      },
    ],
    branding: {
      primaryColor: '#00a960',
      secondaryColor: '#4a90d9',
    },
  };
}
