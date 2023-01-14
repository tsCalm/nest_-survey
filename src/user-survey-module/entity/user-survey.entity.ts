import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  AfterLoad,
} from 'typeorm';
import { BaseEntity } from '../../common/base-entity';
import { Survey } from '../../survey-module/survey.entity';
import { UserResponse } from './user-response.entity';

@Entity()
export class UserSurvey {
  @PrimaryColumn()
  survey_id: number;

  @PrimaryColumn({ type: 'int' })
  user_id: number;

  @Column({ type: 'int', default: 0 })
  user_total_score: number;

  @Column({ type: 'boolean', default: false })
  is_complete: boolean;

  @ManyToOne(() => Survey, (survey) => survey.user_survey, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'survey_id', referencedColumnName: 'id' })
  survey: Survey;

  @OneToMany(() => UserResponse, (userResponse) => userResponse.user_survey)
  user_responses: UserResponse[];

  @AfterLoad()
  calcTotalScore() {
    if (this.is_complete && this.user_responses?.length > 0) {
      const user_total_score = this.user_responses
        .map((resp) => resp.question.score)
        .reduce((cur, acc) => cur + acc, 0);
      this.user_total_score = user_total_score;
    }
  }
}
