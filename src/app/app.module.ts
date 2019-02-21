import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';

import { AppComponent } from './app.component';
import { DesignDialog, FeatureDialog, RDDDialog, RequirementDialog, UserStoryDialog } from './dialogs';

@NgModule({
  declarations: [AppComponent, FeatureDialog, DesignDialog, RDDDialog, RequirementDialog, UserStoryDialog],
  imports: [
    BrowserModule,
    FormsModule,
    BrowserAnimationsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatToolbarModule,
    MatTooltipModule,
    MatTabsModule,
    MatSelectModule,
    MatSnackBarModule,
    NgxDatatableModule
  ],
  providers: [],
  entryComponents: [FeatureDialog, DesignDialog, RDDDialog, RequirementDialog, UserStoryDialog],
  bootstrap: [AppComponent]
})
export class AppModule {}
