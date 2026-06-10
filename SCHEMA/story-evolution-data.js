/**
 * StoryEvolutionData - 剧情演变数据 Schema
 *
 * [铁则合规]
 * - 铁则一：所有数据读写通过此 Schema
 * - 铁则十三：键名格式 {charId}:storyEvolution:{key}
 */

;(function () {
  'use strict';

  var DOMAIN = 'storyEvolution';

  class StoryEvolutionData {
    constructor(platform) {
      this._platform = platform || window.Platform;
    }

    async getTimeline(charId) {
      var data = await this._platform.data(DOMAIN, charId + ':timeline', null);
      return data || { points: [] };
    }

    async saveTimeline(charId, timeline) {
      await this._platform.setData(DOMAIN, charId + ':timeline', timeline);
    }

    async addPoint(charId, point) {
      var timeline = await this.getTimeline(charId);
      timeline.points.push(point);
      // 只保留最近100个演变点
      if (timeline.points.length > 100) {
        timeline.points = timeline.points.slice(-100);
      }
      await this.saveTimeline(charId, timeline);
      return point;
    }

    async getRecent(charId, count) {
      var timeline = await this.getTimeline(charId);
      return timeline.points.slice(-count);
    }
  }

  window.PhoneData = window.PhoneData || {};
  window.PhoneData.StoryEvolution = StoryEvolutionData;

  console.log('[Schema] StoryEvolutionData 已加载');
})();
