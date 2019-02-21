import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { Component, ElementRef, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { MatDialog, MatSnackBar } from '@angular/material';
import { TableColumn } from '@swimlane/ngx-datatable';
import * as FileSaver from 'file-saver';
import * as JsonFormatter from 'json-string-formatter';

import { DesignDialog, FeatureDialog, RDDDialog, RequirementDialog, UserStoryDialog } from './dialogs';
import { Design, Feature, RDD, Requirement, Scenario, TestMetadata, UserStory } from './models';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  constructor(private snackBar: MatSnackBar, private dialog: MatDialog) {}

  @ViewChild('multiselectCellTemplate')
  private multiselectCellTemplate: TemplateRef<any>;

  @ViewChild('actionCellTemplate')
  private actionCellTemplate: TemplateRef<any>;

  @ViewChild('featureFileInput')
  private featureFileInput: ElementRef<HTMLInputElement>;

  @ViewChild('metadataFileInput')
  private metadataFileInput: ElementRef<HTMLInputElement>;

  private testMetadataFilename: string;

  private featureFileFilename: string;

  private readonly dialogOptions = {
    data: {},
    maxWidth: '75%',
    minWidth: '50%',
    minHeight: '50%',
    maxHeight: '75%'
  };

  private readonly columnIds = {
    Requirement: 'RequirementIds',
    Feature: 'Features',
    UserStory: 'UserStories',
    Design: 'DesignIds'
  };

  noMetadataTooltip = 'Load metadata first';

  separatorKeysCodes: number[] = [ENTER, COMMA];

  testMetadata: TestMetadata;

  scenariosColumns: TableColumn[];

  featuresColumns: TableColumn[];

  userStoriesColumns: TableColumn[];

  requirementsColumns: TableColumn[];

  designsColumns: TableColumn[];

  scenarios: Scenario[];

  selectedRDD: RDD;

  get features(): Feature[] {
    return this.testMetadata ? this.testMetadata.Features : [];
  }

  get userStories(): UserStory[] {
    return this.testMetadata ? this.testMetadata.UserStories : [];
  }

  get RDDs(): RDD[] {
    return this.testMetadata ? this.testMetadata.RDDs : [];
  }

  get designs(): Design[] {
    return this.testMetadata ? this.testMetadata.Designs : [];
  }

  get featureLoaded(): boolean {
    return Array.isArray(this.scenarios);
  }

  get featureStatus(): string {
    const name = this.featureFileFilename ? this.featureFileFilename.replace('.feature', '') : '';
    return Array.isArray(this.scenarios) ? `${name ? name : 'OK'} (${this.scenarios.length} scenarios)` : 'not loaded';
  }

  get metadataStatus(): string {
    return this.testMetadata ? 'OK' : 'not loaded';
  }

  getValues(id: string, prop: string): string[] {
    const test = this.testMetadata.getTest(id);
    return test[prop];
  }

  removeValue(id: string, prop: string, value: string): void {
    const test = this.testMetadata.getTest(id);
    const index = test[prop].indexOf(value);
    test[prop].splice(index, 1);
  }

  addValue(id: string, prop: string, event, input): void {
    let value: string;

    if (event.option) {
      value = event.option.value;
    } else if (event.value) {
      value = event.value;
    } else {
      return;
    }

    const test = this.testMetadata.getTest(id);
    const validValues = this.getOptions(id, prop);

    const indexOfValid = validValues.map(x => x.toUpperCase()).indexOf(value.toUpperCase());

    if (indexOfValid !== -1) {
      test[prop].push(validValues[indexOfValid]);
      input.value = null;
    } else {
      console.log(`"${value}" is not a valid value for "${prop}"`);
    }
  }

  private mapPropToStrings(prop: string): string[] {
    let variants: string[];

    switch (prop) {
      case this.columnIds.Requirement:
        variants = this.testMetadata.Requirements.map(x => x.Id);
        break;
      case this.columnIds.Design:
        variants = this.testMetadata.Designs.map(x => x.Design);
        break;
      case this.columnIds.UserStory:
        variants = this.testMetadata.UserStories.map(x => x.UserStory);
        break;
      case this.columnIds.Feature:
        variants = this.testMetadata.Features.map(x => x.Feature);
        break;
    }

    return variants;
  }

  getOptions(id: string, prop: string, filterValue?: string): string[] {
    const test = this.testMetadata.getTest(id);
    let variants = this.mapPropToStrings(prop);
    variants = variants.filter(x => !test[prop].includes(x));

    if (filterValue) {
      variants = variants.filter(x => x.toUpperCase().includes(filterValue.toUpperCase()));
    }

    return variants.sort();
  }

  openFeatureFileSelection(): void {
    this.featureFileInput.nativeElement.click();
  }

  async loadFeatureFile(): Promise<void> {
    const featureFile = this.featureFileInput.nativeElement.files.item(0);
    if (featureFile && featureFile.name) {
      this.featureFileFilename = featureFile.name;
      const text = await new Response(featureFile).text();
      this.scenarios = this.parseFeatureFile(text);
    }
  }

  async loadMetadata(): Promise<void> {
    const metadataFile = this.metadataFileInput.nativeElement.files.item(0);
    this.testMetadataFilename = metadataFile.name;
    const text = await new Response(metadataFile).text();
    this.testMetadata = Object.assign(new TestMetadata(), JSON.parse(text));
  }

  parseFeatureFile(content: string): Scenario[] {
    const scenarios = [];
    const idTag = '@Id_';
    const scenarioTag = 'Scenario:';
    const lines = content
      .split('\n')
      .map(x => x.trim().replace('\r', ''))
      .filter(x => x.startsWith(idTag) || x.startsWith(scenarioTag));

    if (lines.length % 2 != 0) {
      this.snackBar.open('Unmatched Test Ids / Scenarios. Review feature file.', 'OK', { duration: 5000 });
      return null;
    }

    while (lines.length > 0) {
      const id = lines
        .shift()
        .replace(idTag, '')
        .trim();
      const name = lines
        .shift()
        .replace(scenarioTag, '')
        .trim();
      scenarios.push({ id: id, name: name } as Scenario);
    }

    return scenarios;
  }

  openMetadataSelection(): void {
    this.metadataFileInput.nativeElement.click();
  }

  saveMetadata() {
    if (!this.testMetadata) {
      this.snackBar.open('Load metadata first.', 'OK', { duration: 5000 });
      return;
    }

    const defaultFilename = 'TestMetadata.json';
    const filename = this.testMetadataFilename ? this.testMetadataFilename : defaultFilename;
    const json = JSON.stringify(this.testMetadata);
    const formatted = JsonFormatter.format(json);
    const blob = new Blob([formatted]);
    FileSaver.saveAs(blob, filename);
  }

  addNewRDD(): void {
    const options = Object.assign({}, this.dialogOptions);
    options.data = new RDD();
    const dialogRef = this.dialog.open(RDDDialog, options);

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.testMetadata.RDDs.push(result);
        this.selectedRDD = result;
      }
    });
  }

  editRDD(): void {
    const options = Object.assign({}, this.dialogOptions);
    const backup = Object.assign({}, this.selectedRDD);
    options.data = this.selectedRDD;
    const dialogRef = this.dialog.open(RDDDialog, options);

    dialogRef.afterClosed().subscribe(result => {
      if (!result) {
        this.selectedRDD.Location = backup.Location;
        this.selectedRDD.Release = backup.Release;
      }
    });
  }

  removeRDD(): void {
    const index = this.testMetadata.RDDs.indexOf(this.selectedRDD);
    if (index !== -1) {
      this.testMetadata.RDDs.splice(index, 1);
    }
    this.selectedRDD = null;
  }

  addNewRequirement(): void {
    const options = Object.assign({}, this.dialogOptions);
    options.data = new Requirement();
    const dialogRef = this.dialog.open(RequirementDialog, options);

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.selectedRDD.Requirements.unshift(result);
        this.selectedRDD.Requirements = [...this.selectedRDD.Requirements];
      }
    });
  }

  editItem(columnId: string, item: any): void {
    const options = Object.assign({}, this.dialogOptions);
    options.data = item;
    const backup: any = Object.assign({}, options.data);

    const replaceInTests = (prop: string, oldValue: string, newValue: string) => {
      for (const test of this.testMetadata.Tests) {
        for (let i = 0; i < test[prop].length; i++) {
          if (test[prop][i] === oldValue) {
            test[prop][i] = newValue;
          }
        }
      }
    };

    const editRequirement = () => {
      const requirement = item as Requirement;
      const dialogRef = this.dialog.open(RequirementDialog, options);

      dialogRef.afterClosed().subscribe((result: Requirement) => {
        if (!result) {
          requirement.Id = backup.Id;
          requirement.Description = backup.Description;
        } else {
          replaceInTests('RequirementIds', backup.Id, result.Id);
        }
      });
    };

    const editUserStory = () => {
      const userStory = item as UserStory;
      const dialogRef = this.dialog.open(UserStoryDialog, options);

      dialogRef.afterClosed().subscribe((result: UserStory) => {
        if (!result) {
          userStory.UserStory = backup.UserStory;
          userStory.Location = backup.Location;
        } else {
          replaceInTests('UserStories', backup.UserStory, result.UserStory);
        }
      });
    };

    const editFeature = () => {
      const feature = item as Feature;
      const dialogRef = this.dialog.open(FeatureDialog, options);

      dialogRef.afterClosed().subscribe((result: Feature) => {
        if (!result) {
          feature.Feature = backup.Feature;
          feature.Location = backup.Location;
        } else {
          replaceInTests('Features', backup.Feature, result.Feature);
        }
      });
    };

    const editDesign = () => {
      const design = item as Design;
      const dialogRef = this.dialog.open(DesignDialog, options);

      dialogRef.afterClosed().subscribe((result: Design) => {
        if (!result) {
          design.Design = backup.Design;
          design.Location = backup.Location;
        } else {
          replaceInTests('DesignIds', backup.Design, result.Design);
        }
      });
    };

    switch (columnId) {
      case this.columnIds.Requirement:
        editRequirement();
        break;
      case this.columnIds.UserStory:
        editUserStory();
        break;
      case this.columnIds.Feature:
        editFeature();
        break;
      case this.columnIds.Design:
        editDesign();
        break;
    }
  }

  removeItem(columnId: string, item: any): void {
    const removeFromTests = (testProp: string, removeValue: string) => {
      for (const test of this.testMetadata.Tests) {
        const index = test[testProp].indexOf(removeValue);
        if (index === -1) {
          continue;
        } else {
          test[testProp].splice(index, 1);
        }
      }
    };

    const removeItem = (array: any[], testProp: string, itemProp: string) => {
      const index = array.indexOf(item);

      if (index !== -1) {
        array.splice(index, 1);
        removeFromTests(testProp, item[itemProp]);
      }
    };

    switch (columnId) {
      case this.columnIds.Requirement:
        removeItem(this.selectedRDD.Requirements, 'RequirementIds', 'Id');
        this.selectedRDD.Requirements = [...this.selectedRDD.Requirements];
        break;
      case this.columnIds.Design:
        removeItem(this.testMetadata.Designs, 'DesignIds', 'Design');
        this.testMetadata.Designs = [...this.testMetadata.Designs];
        break;
      case this.columnIds.UserStory:
        removeItem(this.testMetadata.UserStories, 'UserStories', 'UserStory');
        this.testMetadata.UserStories = [...this.testMetadata.UserStories];
        break;
      case this.columnIds.Feature:
        removeItem(this.testMetadata.Features, 'Features', 'Feature');
        this.testMetadata.Features = [...this.testMetadata.Features];
        break;
    }
  }

  ngOnInit(): void {
    this.scenariosColumns = [
      {
        name: 'Test Id',
        prop: 'id',
        resizeable: false,
        flexGrow: 0.5
      },
      {
        name: 'Scenario Name',
        prop: 'name',
        resizeable: false,
        flexGrow: 1.5
      },
      {
        name: 'Requirements',
        prop: 'RequirementIds',
        cellTemplate: this.multiselectCellTemplate,
        resizeable: false,
        sortable: false,
        flexGrow: 1
      },
      {
        name: 'Designs',
        prop: 'DesignIds',
        cellTemplate: this.multiselectCellTemplate,
        resizeable: false,
        sortable: false,
        flexGrow: 1
      },
      {
        name: 'User Stories',
        prop: 'UserStories',
        cellTemplate: this.multiselectCellTemplate,
        resizeable: false,
        sortable: false,
        flexGrow: 1
      },
      {
        name: 'Features',
        prop: 'Features',
        cellTemplate: this.multiselectCellTemplate,
        resizeable: false,
        sortable: false,
        flexGrow: 1
      }
    ];

    this.featuresColumns = [
      {
        name: 'Id',
        prop: 'Feature',
        resizeable: false,
        flexGrow: 1
      },
      {
        name: 'Location',
        prop: 'Location',
        resizeable: false,
        flexGrow: 5
      },
      {
        name: '\u00A0',
        prop: this.columnIds.Feature,
        cellTemplate: this.actionCellTemplate,
        flexGrow: 1
      }
    ];

    this.userStoriesColumns = [
      {
        name: 'Id',
        prop: 'UserStory',
        resizeable: false,
        flexGrow: 1
      },
      {
        name: 'Location',
        prop: 'Location',
        resizeable: false,
        flexGrow: 5
      },
      {
        name: '\u00A0',
        prop: this.columnIds.UserStory,
        cellTemplate: this.actionCellTemplate,
        flexGrow: 1
      }
    ];

    this.requirementsColumns = [
      {
        name: 'Id',
        prop: 'Id',
        resizeable: false,
        flexGrow: 1
      },
      {
        name: 'Description',
        prop: 'Description',
        resizeable: false,
        flexGrow: 4
      },
      {
        name: '\u00A0',
        prop: this.columnIds.Requirement,
        cellTemplate: this.actionCellTemplate,
        flexGrow: 1
      }
    ];

    this.designsColumns = [
      {
        name: 'Id',
        prop: 'Design',
        resizeable: false,
        flexGrow: 1
      },
      {
        name: 'Location',
        prop: 'Location',
        resizeable: false,
        flexGrow: 4
      },
      {
        name: '\u00A0',
        prop: this.columnIds.Design,
        cellTemplate: this.actionCellTemplate,
        flexGrow: 1
      }
    ];
  }
}
