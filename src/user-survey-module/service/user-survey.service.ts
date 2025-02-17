import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApolloError } from 'apollo-server-express';
import { STATUS_CODES } from 'http';
import { Repository } from 'typeorm';
import { BaseService } from '../../common/base-service';
import { SurveyQuestion } from '../../question-module/question.entity';
import { SurveyService } from '../../survey-module/survey.service';
import { UserSurveyInput } from '../dto/user-survey.dto';
import { UserSurvey } from '../entity/user-survey.entity';

@Injectable()
export class UserSurveyService extends BaseService<UserSurvey> {
  constructor(
    @InjectRepository(UserSurvey)
    private readonly userSurveyRepo: Repository<UserSurvey>,
    private readonly surveyService: SurveyService,
  ) {
    super('userSurvey');
  }
  calcUserTotalScore(questions: SurveyQuestion[]) {
    if (!questions) return 0;
    return questions.map((obj) => obj.score).reduce((cur, acc) => cur + acc, 0);
  }
  async isComplete(survey_id: number, user_id: number) {
    const { is_complete } = await this.userSurveyRepo.findOne({
      select: ['is_complete'],
      where: {
        survey_id,
        user_id,
      },
    });
    return is_complete;
  }

  completedFindAll(page: number = 1, size: number = 20) {
    return this.userSurveyRepo.find({
      select: ['survey', 'user_responses'],
      where: {
        is_complete: true,
      },
      relations: ['survey', 'user_responses', 'user_responses.question'],
      skip: (page - 1) * size,
      take: size,
    });
  }

  async completedFindOne(userSurveyInput: UserSurveyInput) {
    const findedCompleteSurvey = await this.userSurveyRepo.findOne({
      select: ['survey', 'user_responses'],
      where: userSurveyInput,
      relations: [
        'survey',
        'survey.questions',
        'survey.questions.options',
        'user_responses',
        'user_responses.question',
        'user_responses.question.options',
      ],
    });
    this.findValidate(findedCompleteSurvey);
    console.log('findedCompleteSurvey : ', findedCompleteSurvey);
    return findedCompleteSurvey;
  }
  // 설문을 참여중인지 참여 완료인지 검사
  private userSurveyValidate(entity: UserSurvey) {
    if (entity) {
      throw new ApolloError(
        'You are already participating.',
        STATUS_CODES[400],
        {
          statusCode: 400,
        },
      );
    }
  }
  async create(userSurveyInput: UserSurveyInput) {
    const { survey_id, user_id } = userSurveyInput;
    const findedSurvey = await this.surveyService.findOne(survey_id);
    console.log('findedSurvey : ', findedSurvey);
    if (!findedSurvey.is_complete)
      throw new ApolloError('Can not participate', STATUS_CODES[400], {
        statusCode: 400,
      });
    this.surveyService.findValidate(findedSurvey);
    const findedEntity = await this.userSurveyRepo.findOne({
      where: userSurveyInput,
    });
    this.userSurveyValidate(findedEntity);
    return await this.userSurveyRepo.save(userSurveyInput);
  }

  async userSurveyComplete(userSurveyInput: UserSurveyInput) {
    const { survey_id } = userSurveyInput;
    const findedSurvey = await this.surveyService.findOne(survey_id);
    this.surveyService.findValidate(findedSurvey);
    const findedEntity = await this.userSurveyRepo.findOne({
      where: userSurveyInput,
      relations: ['user_responses', 'user_responses.question'],
    });
    if (findedEntity?.is_complete) {
      throw new ApolloError(
        'already completed user survey.',
        STATUS_CODES[400],
        {
          statusCode: 400,
        },
      );
    }
    const questions = findedEntity.user_responses.map((obj) => obj.question);
    const userTotalScore = this.calcUserTotalScore(questions);
    return await this.userSurveyRepo.save({
      survey_id: findedEntity.survey_id,
      user_id: findedEntity.user_id,
      is_complete: true,
      user_total_score: userTotalScore,
    });
  }
}
