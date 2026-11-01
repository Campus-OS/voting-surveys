import type { ObjectId } from "mongodb";

export interface CandidateDoc {
  id: string; // crypto.randomUUID()
  name: string;
  party?: string;
  imageUrl?: string;
}

export interface SurveyDoc {
  _id: ObjectId;
  name: string;
  description?: string;
  polygon: {
    type: "Polygon";
    coordinates: number[][][]; // GeoJSON standard [longitude, latitude]
  };
  isActive: boolean;
  candidates: CandidateDoc[]; // EMBEDDED (max 50 candidates)
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // admin userId
}

export interface VoteDoc {
  _id: ObjectId;
  surveyId: string; // string, not ObjectId
  candidateId: string;
  location: {
    lat: number;
    lng: number;
  };
  deviceHash: string; // SHA-256 of device identifier
  ip: string; // Client IP
  ipHash: string; // SHA-256 of IP
  createdAt: Date;
}

export interface CandidateWithVotes extends CandidateDoc {
  votes: number;
  percentage: number;
}

export interface SurveyWithVotes extends Omit<SurveyDoc, "_id"> {
  _id: string;
  totalVotes: number;
  candidatesWithVotes: CandidateWithVotes[];
}
