export class Scenario {
  Id: string;
  Name: string;
}

export class TestMetadata {
  Tests: Test[];
  Designs: Design[];
  Features: Feature[];
  UserStories: UserStory[];
  RDDs: RDD[];

  get Requirements(): Requirement[] {
    const requirements = [];
    for (const rdd of this.RDDs) {
      requirements.push(...rdd.Requirements);
    }
    return requirements;
  }

  getTest(id: string): Test {
    let test = this.Tests.find(x => x.Id === id);

    if (test) {
    } else {
      test = new Test(id);
      this.Tests.push(test);
    }

    return test;
  }
}

export class Test {
  constructor(id: string) {
    this.Id = id;
    this.DesignIds = [];
    this.RequirementIds = [];
    this.Features = [];
    this.UserStories = [];
  }

  Id: string;
  DesignIds: string[];
  RequirementIds: string[];
  Features: string[];
  UserStories: string[];
}

export class Design {
  Design: string;
  Location: string;
}

export class Feature {
  Feature: string;
  Location: string;
}

export class UserStory {
  UserStory: string;
  Location: string;
}

export class Requirement {
  Id: string;
  Description: string;
}

export class RDD {
  Release: string;
  Location: string;
  Requirements: Requirement[];
}
