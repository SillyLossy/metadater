import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ComponentType } from '@angular/cdk/overlay';
import { Component, ElementRef, HostListener, OnInit, QueryList, TemplateRef, ViewChild, ViewChildren } from '@angular/core';
import { MatDialog, MatMenuTrigger, MatSnackBar } from '@angular/material';
import { ColumnMode, DatatableComponent, TableColumn } from '@swimlane/ngx-datatable';
import * as FileSaver from 'file-saver';
import * as JsonFormatter from 'json-string-formatter';
import json2csv, { Parser } from 'json2csv';

import { DesignDialog, FeatureDialog, RDDDialog, RequirementDialog, TestDialog, UserStoryDialog } from './dialogs';
import { Design, Feature, RDD, Requirement, Scenario, Test, TestMetadata, UserStory } from './models';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  constructor(public readonly snackBar: MatSnackBar, public readonly dialog: MatDialog) {}

  @ViewChild('multiselectCellTemplate')
  private multiselectCellTemplate: TemplateRef<any>;

  @ViewChild('actionCellTemplate')
  private actionCellTemplate: TemplateRef<any>;

  @ViewChild('usedInTestsCellTemplate')
  private usedInTestsCellTemplate: TemplateRef<any>;

  @ViewChild('dupesSnackTemplate')
  private dupesSnackTemplate: TemplateRef<any>;

  @ViewChild('featureFileInput')
  private featureFileInput: ElementRef<HTMLInputElement>;

  @ViewChild('metadataFileInput')
  private metadataFileInput: ElementRef<HTMLInputElement>;

  @ViewChild('testResultFileInput')
  private testResultFileInput: ElementRef<HTMLInputElement>;

  @ViewChildren(DatatableComponent)
  private datatables: QueryList<DatatableComponent>;

  @ViewChild('contextMenuTrigger', { read: MatMenuTrigger })
  private trigger: MatMenuTrigger;

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
    Design: 'DesignIds',
    Test: 'Tests',
    RDD: 'RDDs'
  };

  private readonly backupKey = 'metadata';

  private unsavedChanges = false;

  @HostListener('window:beforeunload', ['$event'])
  checkUnsaved(event: BeforeUnloadEvent) {
    if (this.unsavedChanges) {
      event.preventDefault();
      event.returnValue = 'There are unsaved changes. Do you really want to exit?';
    }
  }

  filters = {
    Test: '',
    Requirement: '',
    UserStory: '',
    Design: '',
    Feature: ''
  };

  changeColumnMode(): void {
    this.datatables.forEach(table => (table.columnMode = ColumnMode.force));
  }

  noMetadataTooltip = 'Load metadata first';

  separatorKeysCodes: number[] = [ENTER, COMMA];

  testMetadata: TestMetadata;

  scenariosColumns: TableColumn[];

  featuresColumns: TableColumn[];

  userStoriesColumns: TableColumn[];

  requirementsColumns: TableColumn[];

  designsColumns: TableColumn[];

  testsColumns: TableColumn[];

  scenarios: Scenario[];

  selectedRDD: RDD;

  private applyFilter(array: any[], filter: string): any[] {
    const matchValue = (value: string) => value.toUpperCase().includes(filter.toUpperCase());

    return filter
      ? array.filter(x => {
          for (const key of Object.keys(x)) {
            const value = x[key];
            if (Array.isArray(value)) {
              for (const item of value) {
                if (matchValue(item)) {
                  return true;
                }
              }
            } else {
              if (matchValue(value)) {
                return true;
              }
            }
          }
          return false;
        })
      : array;
  }

  get features(): Feature[] {
    return this.testMetadata ? this.applyFilter(this.testMetadata.Features, this.filters.Feature) : [];
  }

  get userStories(): UserStory[] {
    return this.testMetadata ? this.applyFilter(this.testMetadata.UserStories, this.filters.UserStory) : [];
  }

  get designs(): Design[] {
    return this.testMetadata ? this.applyFilter(this.testMetadata.Designs, this.filters.Design) : [];
  }

  get tests(): Test[] {
    return this.testMetadata ? this.applyFilter(this.testMetadata.Tests, this.filters.Test) : [];
  }

  get requirements(): Requirement[] {
    return this.selectedRDD.Requirements
      ? this.applyFilter(this.selectedRDD.Requirements, this.filters.Requirement)
      : [];
  }

  get RDDs(): RDD[] {
    return this.testMetadata ? this.testMetadata.RDDs : [];
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

  get hasBackup(): boolean {
    return localStorage.getItem(this.backupKey) !== null;
  }

  saveBackup(): void {
    this.unsavedChanges = true;
    localStorage.setItem(this.backupKey, JSON.stringify(this.testMetadata));
  }

  loadBackup(): void {
    const data = localStorage.getItem(this.backupKey);

    if (data) {
      this.testMetadata = Object.assign(new TestMetadata(), JSON.parse(data));
      this.checkDuplicates();
    }
  }

  filterAutocompleteEvent(event: MouseEvent): void {
    if (event.button === 2) {
      event.stopPropagation();
      event.preventDefault();
    }
  }

  getValues(id: string, prop: string): string[] {
    const test = this.testMetadata.getTest(id);
    return test[prop];
  }

  removeValue(id: string, prop: string, value: string): void {
    const test = this.testMetadata.getTest(id);
    const index = test[prop].indexOf(value);
    test[prop].splice(index, 1);
    this.saveBackup();
  }

  addValue(id: string, prop: string, event: { option: { value: string }; value: string }, input: { value: any }): void {
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
    this.saveBackup();
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

  openTestResultSelection(): void {
    this.testResultFileInput.nativeElement.click();
  }

  async loadFeatureFile(): Promise<void> {
    const featureFile = this.featureFileInput.nativeElement.files.item(0);
    if (featureFile && featureFile.name) {
      this.featureFileFilename = featureFile.name;
      const text = await new Response(featureFile).text();
      this.scenarios = this.parseFeatureFile(text);
      this.featureFileInput.nativeElement.value = null;
    }
  }

  async loadMetadata(): Promise<void> {
    const metadataFile = this.metadataFileInput.nativeElement.files.item(0);
    this.testMetadataFilename = metadataFile.name;
    const text = await new Response(metadataFile).text();
    this.testMetadata = Object.assign(new TestMetadata(), JSON.parse(text));
    this.checkDuplicates();
    this.metadataFileInput.nativeElement.value = null;
  }

  async loadTestResult(): Promise<void> {
    const testResultFile = this.testResultFileInput.nativeElement.files.item(0);
    const xmlString = await new Response(testResultFile).text();
    const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
    const result = doc.evaluate('//property[starts-with(@value,"Id_")]/@value', doc, null, XPathResult.ANY_TYPE, null);
    let newTests = 0;
    let current = null;
    while ((current = result.iterateNext())) {
      const id = current.value.replace('Id_', '');

      if (this.testMetadata.Tests.filter(t => t.Id === id).length) {
        continue;
      }

      ++newTests;
      this.testMetadata.Tests.unshift(new Test(id));
    }
    this.testMetadata.Tests = [...this.testMetadata.Tests];
    this.snackBar.open(`Added ${newTests} new tests from XML`, 'OK', { duration: 5000 });
    this.testResultFileInput.nativeElement.value = null;
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
      scenarios.push({ Id: id, Name: name } as Scenario);
    }

    return scenarios;
  }

  openMetadataSelection(): void {
    this.metadataFileInput.nativeElement.click();
  }

  private cleanUpTests(): void {
    for (const test of this.testMetadata.Tests) {
      for (const requirement of test.RequirementIds) {
        if (!this.testMetadata.Requirements.find(r => r.Id === requirement)) {
          test.RequirementIds.splice(test.RequirementIds.indexOf(requirement), 1);
        }
      }

      for (const design of test.DesignIds) {
        if (!this.testMetadata.Designs.find(d => d.Design === design)) {
          test.DesignIds.splice(test.DesignIds.indexOf(design), 1);
        }
      }

      for (const feature of test.Features) {
        if (!this.testMetadata.Features.find(f => f.Feature === feature)) {
          test.Features.splice(test.Features.indexOf(feature), 1);
        }
      }

      for (const userStory of test.UserStories) {
        if (!this.testMetadata.UserStories.find(u => u.UserStory === userStory)) {
          test.UserStories.splice(test.UserStories.indexOf(userStory), 1);
        }
      }
    }
  }

  saveMetadata() {
    if (!this.testMetadata) {
      this.snackBar.open('Load metadata first.', 'OK', { duration: 5000 });
      return;
    }

    this.cleanUpTests();
    const defaultFilename = 'TestMetadata.json';
    const filename = this.testMetadataFilename ? this.testMetadataFilename : defaultFilename;
    const json = JSON.stringify(this.testMetadata);
    const formatted = JsonFormatter.format(json);
    const blob = new Blob([formatted]);
    FileSaver.saveAs(blob, filename);
    this.unsavedChanges = false;
    this.checkDuplicates();
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
    this.saveBackup();
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
    this.saveBackup();
  }

  removeRDD(): void {
    const index = this.testMetadata.RDDs.indexOf(this.selectedRDD);
    if (index !== -1) {
      this.testMetadata.RDDs.splice(index, 1);
    }
    this.selectedRDD = null;
    this.saveBackup();
  }

  exportRDD(): void {
    const options = {
      header: true,
      fields: [
        {
          label: 'Id',
          value: 'Id'
        },
        {
          label: 'Description',
          value: 'Description'
        },
        {
          label: 'Used in tests',
          value: 'Tests'
        }
      ]
    } as json2csv.Options<{}>;
    const data = this.selectedRDD.Requirements.map((value: any) => {
      const clone = Object.assign({}, value);
      clone.Tests = this.getUsageInTests(this.columnIds.Requirement, value);
      return clone;
    });
    const parser = new Parser(options);
    const csv = parser.parse(data);
    const blob = new Blob([csv]);
    FileSaver.saveAs(blob, `RDD ${this.selectedRDD.Release} requirements.csv`);
  }

  exportUserStories(): void {
    const options = {
      header: true,
      fields: [
        {
          label: 'Id',
          value: 'UserStory'
        },
        {
          label: 'Location',
          value: 'Location'
        },
        {
          label: 'Used in tests',
          value: 'Tests'
        }
      ]
    } as json2csv.Options<{}>;

    const data = this.testMetadata.UserStories.map((value: any) => {
      const clone = Object.assign({}, value);
      clone.Tests = this.getUsageInTests(this.columnIds.UserStory, value);
      return clone;
    });
    const parser = new Parser(options);
    const csv = parser.parse(data);
    const blob = new Blob([csv]);
    FileSaver.saveAs(blob, 'User Stories.csv');
  }

  exportFeatures(): void {
    const options = {
      header: true,
      fields: [
        {
          label: 'Id',
          value: 'Feature'
        },
        {
          label: 'Location',
          value: 'Location'
        },
        {
          label: 'Used in tests',
          value: 'Tests'
        }
      ]
    } as json2csv.Options<{}>;

    const data = this.testMetadata.Features.map((value: any) => {
      const clone = Object.assign({}, value);
      clone.Tests = this.getUsageInTests(this.columnIds.Feature, value);
      return clone;
    });
    const parser = new Parser(options);
    const csv = parser.parse(data);
    const blob = new Blob([csv]);
    FileSaver.saveAs(blob, 'Features.csv');
  }

  exportDesigns(): void {
    const options = {
      header: true,
      fields: [
        {
          label: 'Id',
          value: 'Design'
        },
        {
          label: 'Location',
          value: 'Location'
        },
        {
          label: 'Used in tests',
          value: 'Tests'
        }
      ]
    } as json2csv.Options<{}>;

    const data = this.testMetadata.Designs.map((value: any) => {
      const clone = Object.assign({}, value);
      clone.Tests = this.getUsageInTests(this.columnIds.Design, value);
      return clone;
    });
    const parser = new Parser(options);
    const csv = parser.parse(data);
    const blob = new Blob([csv]);
    FileSaver.saveAs(blob, 'Designs.csv');
  }

  exportTests(): void {
    const options = {
      header: true,
      flatten: true,
      fields: [
        {
          label: 'Id',
          value: 'Id'
        },
        {
          label: 'Designs',
          value: 'DesignIds'
        },
        {
          label: 'Requirements',
          value: 'RequirementIds'
        },
        {
          label: 'Features',
          value: 'Features'
        },
        {
          label: 'User Stories',
          value: 'UserStories'
        }
      ]
    } as json2csv.Options<{}>;

    const data = this.testMetadata.Tests;
    const parser = new Parser(options);
    const csv = parser.parse(data);
    const blob = new Blob([csv]);
    FileSaver.saveAs(blob, 'Tests.csv');
  }

  addItem(columnId: string): void {
    const options = Object.assign({}, this.dialogOptions);

    const addRequirement = () => {
      options.data = new Requirement();
      const dialogRef = this.dialog.open(RequirementDialog, options);

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.selectedRDD.Requirements.unshift(result);
          this.selectedRDD.Requirements = [...this.selectedRDD.Requirements];
        }
      });
    };

    const genericAdd = (data: any, dialogClass: ComponentType<{}>, arrayProp: string) => {
      options.data = data;
      const dialogRef = this.dialog.open(dialogClass, options);

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.testMetadata[arrayProp].unshift(result);
          this.testMetadata[arrayProp] = [...this.testMetadata[arrayProp]];
        }
      });
    };

    switch (columnId) {
      case this.columnIds.Requirement:
        addRequirement();
        break;
      case this.columnIds.Design:
        genericAdd(new Design(), DesignDialog, 'Designs');
        break;
      case this.columnIds.Test:
        genericAdd(new Test(''), TestDialog, 'Tests');
        break;
      case this.columnIds.Feature:
        genericAdd(new Feature(), FeatureDialog, 'Features');
        break;
      case this.columnIds.UserStory:
        genericAdd(new UserStory(), UserStoryDialog, 'UserStories');
        break;
    }

    this.saveBackup();
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

    const genericEdit = (dialogClass: ComponentType<{}>, displayProp?: string) => {
      const dialogRef = this.dialog.open(dialogClass, options);

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          if (displayProp) {
            replaceInTests(columnId, backup[displayProp], result[displayProp]);
          }
          if (dialogClass === RequirementDialog) {
            const oldName = backup.Id;
            const newName = result.Id;

            for (const requirement of this.selectedRDD.Requirements) {
              if (requirement.Id.startsWith(oldName)) {
                const oldId = requirement.Id;
                const newId = oldId.replace(new RegExp(`^${oldName}`), newName);
                requirement.Id = newId;
                replaceInTests(columnId, oldId, newId);
              }
            }
          }
        } else {
          for (const key of Object.keys(item)) {
            item[key] = backup[key];
          }
        }
      });
    };

    switch (columnId) {
      case this.columnIds.Requirement:
        genericEdit(RequirementDialog, 'Id');
        break;
      case this.columnIds.UserStory:
        genericEdit(UserStoryDialog, 'UserStory');
        break;
      case this.columnIds.Feature:
        genericEdit(FeatureDialog, 'Feature');
        break;
      case this.columnIds.Design:
        genericEdit(DesignDialog, 'Design');
        break;
      case this.columnIds.Test:
        genericEdit(TestDialog);
        break;
    }

    this.saveBackup();
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

    const removeItem = (array: any[], testProp?: string, itemProp?: string) => {
      const index = array.indexOf(item);

      if (index !== -1) {
        array.splice(index, 1);
        if (testProp && itemProp) {
          removeFromTests(testProp, item[itemProp]);
        }
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
      case this.columnIds.Test:
        removeItem(this.testMetadata.Tests);
        this.testMetadata.Tests = [...this.testMetadata.Tests];
        break;
      case this.columnIds.RDD:
        removeItem(this.testMetadata.RDDs);
        break;
    }

    this.saveBackup();
  }

  private contextProp: string;
  private contextTest: Test;

  private clipboard = {
    RequirementIds: [],
    Features: [],
    UserStories: [],
    DesignIds: []
  };

  dupesStatus = [];

  private checkDuplicates(): void {
    if (!this.testMetadata) {
      return;
    }

    this.dupesStatus = [];
    const testDupes = new Set<string>();

    for (const test of this.testMetadata.Tests) {
      if (this.testMetadata.Tests.filter(t => t.Id === test.Id).length > 1) {
        testDupes.add(test.Id);
      }
    }

    if (testDupes.size) {
      this.dupesStatus.push('Duplicate tests found!');
      this.dupesStatus.push(Array.from(testDupes).join(', '));
    }

    const requirementDupes = new Set<string>();

    for (const requirement of this.testMetadata.Requirements) {
      if (this.testMetadata.Requirements.filter(r => r.Id === requirement.Id).length > 1) {
        requirementDupes.add(requirement.Id);
      }
    }

    if (requirementDupes.size) {
      this.dupesStatus.push('Duplicate requirements found!');
      this.dupesStatus.push(Array.from(requirementDupes).join(', '));
    }

    const designDupes = new Set<string>();

    for (const design of this.testMetadata.Designs) {
      if (this.testMetadata.Designs.filter(d => d.Design === design.Design).length > 1) {
        designDupes.add(design.Design);
      }
    }

    if (designDupes.size) {
      this.dupesStatus.push('Duplicate designs found!');
      this.dupesStatus.push(Array.from(designDupes).join(', '));
    }

    const userStoryDupes = new Set<string>();

    for (const userStory of this.testMetadata.UserStories) {
      if (this.testMetadata.UserStories.filter(u => u.UserStory === userStory.UserStory).length > 1) {
        userStoryDupes.add(userStory.UserStory);
      }
    }

    if (userStoryDupes.size) {
      this.dupesStatus.push('Duplicate user stories found!');
      this.dupesStatus.push(Array.from(userStoryDupes).join(', '));
    }

    const featureDupes = new Set<string>();

    for (const feature of this.testMetadata.Features) {
      if (this.testMetadata.Features.filter(f => f.Feature === feature.Feature).length > 1) {
        featureDupes.add(feature.Feature);
      }
    }

    if (featureDupes.size) {
      this.dupesStatus.push('Duplicate features found!');
      this.dupesStatus.push(Array.from(featureDupes).join(', '));
    }

    if (this.dupesStatus.length) {
      this.snackBar.openFromTemplate(this.dupesSnackTemplate);
    }
  }

  get pasteDisabled(): boolean {
    return !this.contextProp || this.clipboard[this.contextProp].length === 0;
  }

  copy(): void {
    if (!this.contextProp || !this.contextTest) {
      return;
    }

    this.clipboard[this.contextProp] = this.contextTest[this.contextProp];
  }

  paste(): void {
    if (!this.contextProp || !this.contextTest) {
      return;
    }

    const set = new Set<string>(this.clipboard[this.contextProp].concat(this.contextTest[this.contextProp]));
    this.contextTest[this.contextProp] = Array.from(set);
    this.saveBackup();
  }

  clear(): void {
    if (!this.contextProp || !this.contextTest) {
      return;
    }

    this.contextTest[this.contextProp] = [];
    this.saveBackup();
  }

  setContextProp(prop: string): void {
    if (Object.keys(this.clipboard).includes(prop)) {
      this.contextProp = prop;
    }
  }

  onTableContextMenu(contextMenuEvent: { type: string; content: Test; event: MouseEvent }) {
    if (contextMenuEvent.type !== 'body') {
      return;
    }

    this.contextTest = contextMenuEvent.content;
    const rawEvent = contextMenuEvent.event;
    this.trigger.openMenu();
    const menu = document.querySelector('.mat-menu-panel') as HTMLElement;
    menu.style.position = 'absolute';
    menu.style.left = `${rawEvent.x}px`;
    menu.style.top = `${rawEvent.y}px`;

    rawEvent.preventDefault();
    rawEvent.stopPropagation();
  }

  getUsageInTests(columnId: string, item: any): number {
    let value: string;
    let number = 0;

    switch (columnId) {
      case this.columnIds.Requirement:
        value = item.Id;
        break;
      case this.columnIds.Design:
        value = item.Design;
        break;
      case this.columnIds.UserStory:
        value = item.UserStory;
        break;
      case this.columnIds.Feature:
        value = item.Feature;
        break;
    }

    for (const test of this.testMetadata.Tests) {
      if (test[columnId].includes(value)) {
        ++number;
      }
    }

    return number;
  }

  ngOnInit(): void {
    this.scenariosColumns = [
      {
        name: 'Test Id',
        prop: 'Id',
        flexGrow: 0.5
      },
      {
        name: 'Scenario Name',
        prop: 'Name',
        flexGrow: 1.5
      },
      {
        name: 'Requirements',
        prop: 'RequirementIds',
        cellTemplate: this.multiselectCellTemplate,
        sortable: false,
        flexGrow: 1
      },
      {
        name: 'Designs',
        prop: 'DesignIds',
        cellTemplate: this.multiselectCellTemplate,
        sortable: false,
        flexGrow: 1
      },
      {
        name: 'User Stories',
        prop: 'UserStories',
        cellTemplate: this.multiselectCellTemplate,
        sortable: false,
        flexGrow: 1
      },
      {
        name: 'Features',
        prop: 'Features',
        cellTemplate: this.multiselectCellTemplate,
        sortable: false,
        flexGrow: 1
      }
    ];

    this.testsColumns = [
      {
        name: 'Id',
        prop: 'Id',
        flexGrow: 1
      },
      {
        name: 'Requirements',
        prop: 'RequirementIds',
        cellTemplate: this.multiselectCellTemplate,
        sortable: false,
        flexGrow: 2
      },
      {
        name: 'Designs',
        prop: 'DesignIds',
        cellTemplate: this.multiselectCellTemplate,
        sortable: false,
        flexGrow: 2
      },
      {
        name: 'User Stories',
        prop: 'UserStories',
        cellTemplate: this.multiselectCellTemplate,
        sortable: false,
        flexGrow: 2
      },
      {
        name: 'Features',
        prop: 'Features',
        cellTemplate: this.multiselectCellTemplate,
        sortable: false,
        flexGrow: 2
      },
      {
        name: '\u00A0',
        prop: this.columnIds.Test,
        cellTemplate: this.actionCellTemplate,
        flexGrow: 1
      }
    ];

    this.featuresColumns = [
      {
        name: 'Id',
        prop: 'Feature',
        flexGrow: 1
      },
      {
        name: 'Location',
        prop: 'Location',
        flexGrow: 5
      },
      {
        name: 'Used in tests',
        prop: this.columnIds.Feature,
        cellTemplate: this.usedInTestsCellTemplate,
        sortable: false,
        flexGrow: 1
      },
      {
        name: '\u00A0',
        prop: this.columnIds.Feature,
        cellTemplate: this.actionCellTemplate,
        resizeable: false,
        sortable: false,
        flexGrow: 1
      }
    ];

    this.userStoriesColumns = [
      {
        name: 'Id',
        prop: 'UserStory',
        flexGrow: 1
      },
      {
        name: 'Location',
        prop: 'Location',
        flexGrow: 4
      },
      {
        name: 'Used in tests',
        prop: this.columnIds.UserStory,
        cellTemplate: this.usedInTestsCellTemplate,
        sortable: false,
        flexGrow: 1
      },
      {
        name: '\u00A0',
        prop: this.columnIds.UserStory,
        cellTemplate: this.actionCellTemplate,
        sortable: false,
        resizeable: false,
        flexGrow: 1
      }
    ];

    this.requirementsColumns = [
      {
        name: 'Id',
        prop: 'Id',
        flexGrow: 1
      },
      {
        name: 'Description',
        prop: 'Description',
        flexGrow: 4
      },
      {
        name: 'Used in tests',
        prop: this.columnIds.Requirement,
        cellTemplate: this.usedInTestsCellTemplate,
        sortable: false,
        flexGrow: 1
      },
      {
        name: '\u00A0',
        prop: this.columnIds.Requirement,
        cellTemplate: this.actionCellTemplate,
        sortable: false,
        resizeable: false,
        flexGrow: 1
      }
    ];

    this.designsColumns = [
      {
        name: 'Id',
        prop: 'Design',
        flexGrow: 1
      },
      {
        name: 'Location',
        prop: 'Location',
        flexGrow: 4
      },
      {
        name: 'Used in tests',
        prop: this.columnIds.Design,
        cellTemplate: this.usedInTestsCellTemplate,
        sortable: false,
        flexGrow: 1
      },
      {
        name: '\u00A0',
        prop: this.columnIds.Design,
        cellTemplate: this.actionCellTemplate,
        sortable: false,
        resizeable: false,
        flexGrow: 1
      }
    ];
  }
}
