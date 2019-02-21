import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';

import { Design, Feature, RDD, Requirement, Test, UserStory } from './models';

@Component({
  selector: 'rdd-dialog',
  templateUrl: 'rdd.dialog.html',
  styleUrls: ['dialogs.scss']
})
export class RDDDialog {
  constructor(public dialogRef: MatDialogRef<RDDDialog>, @Inject(MAT_DIALOG_DATA) public data: RDD) {}

  onNoClick(): void {
    this.dialogRef.close();
  }

  get valid(): boolean {
    return !!this.data.Release && !!this.data.Location;
  }
}

@Component({
  selector: 'requirement-dialog',
  templateUrl: 'requirement.dialog.html',
  styleUrls: ['dialogs.scss']
})
export class RequirementDialog {
  constructor(public dialogRef: MatDialogRef<RDDDialog>, @Inject(MAT_DIALOG_DATA) public data: Requirement) {}

  onNoClick(): void {
    this.dialogRef.close();
  }

  get valid(): boolean {
    return !!this.data.Description && !!this.data.Id;
  }
}

@Component({
  selector: 'user-story-dialog',
  templateUrl: 'user-story.dialog.html',
  styleUrls: ['dialogs.scss']
})
export class UserStoryDialog {
  constructor(public dialogRef: MatDialogRef<RDDDialog>, @Inject(MAT_DIALOG_DATA) public data: UserStory) {}

  onNoClick(): void {
    this.dialogRef.close();
  }

  get valid(): boolean {
    return !!this.data.Location && !!this.data.UserStory;
  }
}

@Component({
  selector: 'feature-dialog',
  templateUrl: 'feature.dialog.html',
  styleUrls: ['dialogs.scss']
})
export class FeatureDialog {
  constructor(public dialogRef: MatDialogRef<RDDDialog>, @Inject(MAT_DIALOG_DATA) public data: Feature) {}

  onNoClick(): void {
    this.dialogRef.close();
  }

  get valid(): boolean {
    return !!this.data.Location && !!this.data.Feature;
  }
}

@Component({
  selector: 'design-dialog',
  templateUrl: 'design.dialog.html',
  styleUrls: ['dialogs.scss']
})
export class DesignDialog {
  constructor(public dialogRef: MatDialogRef<RDDDialog>, @Inject(MAT_DIALOG_DATA) public data: Design) {}

  onNoClick(): void {
    this.dialogRef.close();
  }

  get valid(): boolean {
    return !!this.data.Location && !!this.data.Design;
  }
}

@Component({
  selector: 'test-dialog',
  templateUrl: 'test.dialog.html',
  styleUrls: ['dialogs.scss']
})
export class TestDialog {
  constructor(public dialogRef: MatDialogRef<RDDDialog>, @Inject(MAT_DIALOG_DATA) public data: Test) {}

  onNoClick(): void {
    this.dialogRef.close();
  }

  get valid(): boolean {
    return !!this.data.Id && !!this.data.Release;
  }
}
